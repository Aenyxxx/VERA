// Resume Screening (PRD FR-SCR-01..06, decided Oct 7, 2026):
// shortlist per group, review sheet, per-document verification, document requests, HR Drop + refill.
// Lock order in every transaction (DATABASE_SCHEMA §8): job_vacancy → applicant → application.
// No svc calls here. Status changes only through statusMachine.transition; HR is the history actor.
import {
  APPLICANT_TYPE,
  APPLICATION_STATUS as A,
  DOCUMENT_TYPE_LABELS,
  DROP_REASON_LABELS,
  NOTIFICATION_TYPE as N,
  REQUEST_STATUS,
  VACANCY_STATUS as V,
  VERIFICATION_STATUS,
} from "@vera/shared";

import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/tx.js";
import { notify } from "../../domain/notify.js";
import { reusedRatingsSource } from "../../domain/reuse.js";
import { compareCandidates, refreshShortlist } from "../../domain/shortlist.js";
import { transition } from "../../domain/statusMachine.js";
import { isFullyVerified, responseDueAt } from "../../domain/verification.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { signedUrl } from "../../lib/storage.js";
import { lockApplicant } from "../applications/applications.repository.js";
import { findEvaluationSummary } from "../evaluations/evaluations.repository.js";
import { lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  cancelPendingRequests,
  cancelRequest,
  findApplicationForHr,
  findCurrentDocumentForHr,
  findCurrentResume,
  findDocumentOwner,
  findResumeOwner,
  findScreeningVacancy,
  insertDocumentRequest,
  listApplicationRequests,
  listCurrentDocumentsForHr,
  listScreeningApplications,
  listScreeningVacancies,
  lockApplication,
  markReuploadRequested,
  setDocumentVerification,
  setResumeVerification,
  startVerification,
} from "./screening.repository.js";

const SCREENED_VACANCIES = [V.OPEN, V.CLOSED, V.ENDORSING];
const NOT_SHORTLISTED = [A.PRESCREEN_FAILED, A.BELOW_THRESHOLD];
const notInScreening = () => conflict("This application is no longer in screening. Refresh the page.");
const documentLabel = (type, label) => (label ? `${DOCUMENT_TYPE_LABELS[type]} (${label})` : DOCUMENT_TYPE_LABELS[type]);

/** A shortlisted slot is locked once HR's first verification action set verification_started_at (BR-12, FR-SCR-03). */
const isLocked = (row) => row.status === A.SHORTLISTED && row.verificationStartedAt != null;

function verificationSummary(row) {
  const documents = row.documentStatuses.map((verificationStatus) => ({ verificationStatus }));
  return {
    documentsVerified: documents.filter((d) => d.verificationStatus === VERIFICATION_STATUS.VERIFIED).length,
    documentsTotal: documents.length,
    resumeStatus: row.resumeStatus,
    newUploads: row.newUploads,
    pendingRequests: row.pendingRequests,
    fullyVerified: isFullyVerified({
      resume: row.resumeStatus ? { verificationStatus: row.resumeStatus } : null,
      documents,
      requests: Array.from({ length: row.pendingRequests }, () => ({ status: REQUEST_STATUS.PENDING })),
    }),
  };
}

// ---------------------------------------------------------------- read

/** GET /api/admin/screening */
export async function getScreeningOverview() {
  return listScreeningVacancies({
    statuses: SCREENED_VACANCIES,
    shortlisted: A.SHORTLISTED,
    waiting: A.WAITING_POOL,
    rejected: NOT_SHORTLISTED,
  });
}

/** GET /api/admin/screening/:vacancyId — both groups, waiting pools, and the not-shortlisted lists (FR-SCR-01). */
export async function getScreeningVacancy(vacancyId) {
  const vacancy = await findScreeningVacancy(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  const rows = await listScreeningApplications(vacancyId, [A.SHORTLISTED, A.WAITING_POOL, ...NOT_SHORTLISTED]);

  const entry = (row) => ({
    applicationId: row.applicationId,
    applicantName: row.applicantName,
    matchingScore: row.matchingScore,
    appliedAt: row.appliedAt,
    locked: isLocked(row),
    ratingsOnFile: row.ratingsOnFile,
    ...verificationSummary(row),
  });
  const group = (type) => ({
    quota: vacancy.quota,
    shortlisted: rows.filter((r) => r.applicantType === type && r.status === A.SHORTLISTED).sort(compareCandidates).map(entry),
    waitingPool: rows.filter((r) => r.applicantType === type && r.status === A.WAITING_POOL).sort(compareCandidates).map(entry),
  });
  const rejected = (status) =>
    rows
      .filter((r) => r.status === status)
      .map((r) => ({
        applicationId: r.applicationId,
        applicantName: r.applicantName,
        applicantType: r.applicantType,
        appliedAt: r.appliedAt,
        matchingScore: r.matchingScore, // null for prescreen failures (never matched)
        reason: r.statusReason,
      }));

  return {
    vacancy,
    groups: {
      [APPLICANT_TYPE.EXPERIENCED]: group(APPLICANT_TYPE.EXPERIENCED),
      [APPLICANT_TYPE.FIRST_TIME]: group(APPLICANT_TYPE.FIRST_TIME),
    },
    notShortlisted: {
      prescreenFailed: rejected(A.PRESCREEN_FAILED).sort((a, b) => new Date(a.appliedAt) - new Date(b.appliedAt)),
      belowThreshold: rejected(A.BELOW_THRESHOLD).sort((a, b) => b.matchingScore - a.matchingScore),
    },
  };
}

/** GET /api/admin/applications/:id — the review sheet (FR-SCR-02). */
export async function getApplicationForHr(applicationId) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  const [resumeRow, documents, requests, reusableEvaluation, evaluation] = await Promise.all([
    findCurrentResume(app.applicantId),
    listCurrentDocumentsForHr(app.applicantId),
    listApplicationRequests(applicationId),
    reusedRatingsSource(pool, app.applicantId, applicationId),
    findEvaluationSummary(applicationId),
  ]);
  const { filePath: _resumePath, ...resume } = resumeRow ?? {};
  const fullyVerified = isFullyVerified({ resume: resumeRow, documents, requests });
  const shortlisted = app.status === A.SHORTLISTED;

  return {
    application: {
      applicationId: app.applicationId,
      status: app.status,
      statusReason: app.statusReason,
      applicantType: app.applicantType,
      applicationSource: app.applicationSource,
      appliedAt: app.appliedAt,
      locked: isLocked(app),
    },
    vacancy: { vacancyId: app.vacancyId, jobTitle: app.jobTitle, companyName: app.companyName },
    applicant: {
      firstName: app.firstName,
      middleName: app.middleName,
      lastName: app.lastName,
      suffix: app.suffix,
      email: app.email,
      contactNumber: app.contactNumber,
      age: app.age,
      gender: app.gender,
      educationLevel: app.educationLevel,
      heightCm: app.heightCm,
      addressLine: app.addressLine,
      city: app.city,
      province: app.province,
    },
    matching:
      app.matchingScore == null
        ? null
        : {
            matchingScore: app.matchingScore,
            skillsScore: app.skillsScore,
            experienceScore: app.experienceScore,
            yearsExperience: app.yearsExperience,
            matchedSkills: app.matchedSkills,
            missingSkills: app.missingSkills,
            skillMatches: app.skillMatches,
            experienceMatches: app.experienceMatches,
            weights: app.weights,
            modelName: app.modelName,
          },
    resume: resumeRow ? resume : null,
    documents,
    requests,
    fullyVerified,
    // BR-21: ratings on file → Compute final score (reused ratings, S14), never an interview (S13).
    nextStep: shortlisted && fullyVerified ? (reusableEvaluation ? "reuse_ratings" : "schedule_interview") : null,
    reusableEvaluation,
    // S14: the stored result once evaluated or computed from reused ratings (HR only), else null.
    evaluation,
  };
}

/** Signed links (10 min) for HR, checked against the application's applicant. */
export async function getResumeUrlForHr(applicationId) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  const resume = await findCurrentResume(app.applicantId);
  if (!resume) throw notFound("No current resume.");
  return { url: await signedUrl("resumes", resume.filePath) };
}

export async function getDocumentUrlForHr(applicationId, documentId) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  const document = await findCurrentDocumentForHr(app.applicantId, documentId);
  if (!document) throw notFound("That document was not found.");
  return { url: await signedUrl("documents", document.filePath) };
}

// ---------------------------------------------------------------- write

/**
 * Runs fn under the screening locks: job_vacancy (first, same row the shortlist refresh locks, so a refresh can
 * never demote an application HR is acting on) → application. The application must still be shortlisted.
 */
async function withShortlistedApplication(hrId, applicationId, fn) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  return withTransaction(hrId, async (client) => {
    await lockVacancy(client, app.vacancyId); // 1. job_vacancy
    const locked = await lockApplication(client, applicationId); // 3. application (no applicant row needed here)
    if (!locked || locked.status !== A.SHORTLISTED) throw notInScreening();
    return fn(client, { ...locked, jobTitle: app.jobTitle, userId: app.userId });
  });
}

function assertSameApplicant(ownerId, application) {
  if (!ownerId || ownerId !== application.applicantId) {
    throw businessRule("That document does not belong to this application's applicant, or it was replaced.");
  }
}

/** PATCH /api/admin/resumes/:id/verification { status, remarks?, applicationId } (FR-SCR-02/03). */
export async function verifyResume(hrId, resumeId, { status, remarks, applicationId }) {
  const owner = await findResumeOwner(resumeId);
  return withShortlistedApplication(hrId, applicationId, async (client, application) => {
    assertSameApplicant(owner, application);
    await startVerification(client, applicationId); // first HR action locks the slot
    const updated = await setResumeVerification(client, { resumeId, applicantId: owner, status, remarks, hrId });
    if (!updated) throw conflict("This resume was replaced. Refresh the page.");
    return { resumeId, verificationStatus: status };
  });
}

/** PATCH /api/admin/documents/:id/verification { status, remarks?, applicationId } (FR-SCR-02/03). */
export async function verifyDocument(hrId, documentId, { status, remarks, applicationId }) {
  const owner = await findDocumentOwner(documentId);
  return withShortlistedApplication(hrId, applicationId, async (client, application) => {
    assertSameApplicant(owner, application);
    await startVerification(client, applicationId);
    const updated = await setDocumentVerification(client, { documentId, applicantId: owner, status, remarks, hrId });
    if (!updated) throw conflict("This document was replaced. Refresh the page.");
    return { documentId, verificationStatus: status };
  });
}

/**
 * POST /api/admin/document-requests { applicationId, documentType, targetDocumentId?, reason } (FR-SCR-04).
 * Deadline from system_setting; no automatic expiry (HR drops manually after it).
 */
export async function requestDocument(hrId, { applicationId, documentType, targetDocumentId, reason }) {
  return withShortlistedApplication(hrId, applicationId, async (client, application) => {
    if (targetDocumentId) {
      const target = await findCurrentDocumentForHr(application.applicantId, targetDocumentId, client);
      if (!target || target.documentType !== documentType) {
        throw businessRule("Pick a current document of the requested type, or leave it empty to request a missing one.");
      }
      await markReuploadRequested(client, { documentId: targetDocumentId, applicantId: application.applicantId, remarks: reason, hrId });
    }
    await startVerification(client, applicationId);
    const dueAt = await responseDueAt(client);
    const request = await insertDocumentRequest(client, {
      applicantId: application.applicantId,
      applicationId,
      documentType,
      targetDocumentId: targetDocumentId ?? null,
      reason,
      hrId,
      dueAt,
    });
    await notify(client, {
      userId: application.userId,
      type: N.DOCUMENT_REQUESTED,
      applicationId,
      vars: { jobTitle: application.jobTitle, documentLabel: documentLabel(documentType), reason, dueAt },
      linkPath: "/applicant/documents",
      requiresAction: true,
    });
    return request;
  });
}

/** DELETE /api/admin/document-requests/:id — HR withdraws a pending request. */
export async function withdrawRequest(hrId, requestId) {
  const cancelled = await withTransaction(hrId, (client) => cancelRequest(client, requestId));
  if (!cancelled) throw notFound("No pending request with that id.");
  return { requestId, status: REQUEST_STATUS.CANCELLED };
}

/** Default drop check: only a shortlisted application can be dropped from screening; the input is the reason. */
async function shortlistedOnly(_client, locked, input) {
  if (!locked || locked.status !== A.SHORTLISTED) throw notInScreening();
  return input;
}

/**
 * POST /api/admin/applications/:id/drop { reason, remarks? } (FR-SCR-05 simplified: HR drops manually).
 * dropped is a failed outcome: it frees the applicant and blocks the company for them (BR-18, BR-19).
 * The freed slot is refilled from the waiting pool in the same transaction (BR-11).
 * @param {(client, locked, input) => Promise<{ reason: string, remarks: string|null }>} [checkLocked]
 *   runs under the locks, re-checks the locked application (409 if it moved) and returns the drop reason.
 *   S13 Mark no-show passes its own check (interviews.service.js), so both drops share one path.
 */
export async function dropApplication(hrId, applicationId, input, checkLocked = shortlistedOnly) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  return withTransaction(hrId, async (client) => {
    // Lock order (DATABASE_SCHEMA §8): job_vacancy → applicant → application.
    await lockVacancy(client, app.vacancyId);
    await lockApplicant(client, app.applicantId);
    const locked = await lockApplication(client, applicationId);
    const { reason, remarks } = await checkLocked(client, locked, input);

    const reasonText = `Dropped by HR: ${DROP_REASON_LABELS[reason]}${remarks ? ` — ${remarks}` : ""}`;
    await transition(client, locked, A.DROPPED, reasonText); // HR is the history actor (vera.actor_id)
    await cancelPendingRequests(client, applicationId);
    await notify(client, { userId: app.userId, type: N.APPLICATION_DROPPED, applicationId, vars: { jobTitle: app.jobTitle } });
    // Vacancy row already locked above; refresh moves are recorded as the system.
    const { promoted } = await refreshShortlist(client, app.vacancyId, locked.applicantType);
    return { applicationId, status: A.DROPPED, promoted };
  });
}
