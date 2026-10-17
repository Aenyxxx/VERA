// Pool matching on publish and job invitations (Phase 3; PRD FR-VAC-02, FR-POOL-02/03; decision 17, answers 7, 8, 14):
// - Publish (and HR's "Run pool matching again") starts ONE background run per vacancy: the publish has already
//   committed and answered; svc is never called inside a transaction (CLAUDE.md rule 7). Each pool candidate is
//   prescreened (RANK-01), matched with the source application's type (MAT-04) with a 15 s svc timeout, and checked
//   against the threshold (RANK-02); RANK-05 decides, and everyone who qualifies is invited (no ranking).
// - The run's result { invited, skipped, failed } is stored on the vacancy and sent to HR as a notice.
// - The applicant accepts (→ a normal application at waiting_pool, source talent_pool, matching from the invitation,
//   shortlist refresh, pool entry closed) or declines (→ stays in the pool). A failed accept re-check expires the
//   invitation (committed) and answers 409. When the vacancy leaves "open", its pending invitations expire
//   (domain/invitationExpiry.js).
// Lock order (DATABASE_SCHEMA §8): job_vacancy → applicant → application. The applicant never sees the company or a
// score (CLAUDE.md rule 4); logs carry ids only.
import {
  APPLICATION_SOURCE,
  APPLICATION_STATUS as A,
  INVITATION_STATUS as IS,
  NOTIFICATION_TYPE as N,
  POOL_AVAILABILITY,
  resolveMatchingWeights,
  VACANCY_STATUS,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { expireJobInvitations } from "../../domain/invitationExpiry.js";
import { messageFor, notify, notifyStaff } from "../../domain/notify.js";
import { invitationExclusion } from "../../domain/poolMatching.js";
import { prescreen } from "../../domain/prescreen.js";
import { meetsThreshold, refreshShortlist, storedMatchingScore } from "../../domain/shortlist.js";
import { assertInitial } from "../../domain/statusMachine.js";
import { assertTransition as assertVacancyTransition } from "../../domain/vacancyStatus.js";
import { responseDueAt } from "../../domain/verification.js";
import { conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { matchResume } from "../../lib/svcClient.js";
import {
  findApplicantForApply,
  findVacancyForApply,
  hasApplied,
  insertApplication,
  insertMatchingResult,
  isAtFailedCompany,
  lockApplicant,
} from "../applications/applications.repository.js";
import {
  closePoolEntry,
  findBlocking,
  findOffer,
  findPendingOffer,
  setOfferStatus,
  setPoolAvailability,
} from "../rematch/rematch.repository.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import { findVacancyInvitations, insertInvitation, isPoolEntryActive, listPoolCandidates, setPoolMatchSummary } from "./invitations.repository.js";

/** svc timeout per call in the background run (answer 14); apply and the rematch keep the 60 s default. */
export const POOL_MATCH_TIMEOUT_MS = 15_000;

// One run per vacancy at a time (single API process). The flag is set synchronously, before any await.
const running = new Set();
export const isPoolMatchingRunning = (vacancyId) => running.has(vacancyId);

/**
 * Starts the background run. Returns its promise (tests await it; the controllers do not), or null when a run is
 * already going for this vacancy. Never throws: errors are logged with ids only.
 */
export function startPoolMatching(actorId, vacancyId) {
  if (running.has(vacancyId)) return null;
  running.add(vacancyId);
  return runPoolMatching(actorId, vacancyId)
    .catch((error) => {
      logger.error({ vacancyId, name: error.name, code: error.code }, "pool matching failed");
      return null;
    })
    .finally(() => running.delete(vacancyId));
}

/** POST /api/admin/vacancies/:id/pool-matching ("Run pool matching again"): open vacancies only → 202. */
export async function requestPoolMatching(actorId, vacancyId) {
  const vacancy = await findVacancyForApply(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  if (vacancy.status !== VACANCY_STATUS.OPEN) throw conflict("Pool matching runs only for an open job.");
  if (!startPoolMatching(actorId, vacancyId)) throw conflict("Pool matching is already running for this job.");
  return { status: "started" };
}

/** GET /api/admin/vacancies/:id/invitations (HR). */
export async function getVacancyInvitations(vacancyId) {
  const found = await findVacancyInvitations(vacancyId);
  if (!found) throw notFound("Vacancy not found.");
  const { jobTitle: _title, status: _status, ...rest } = found;
  return { running: isPoolMatchingRunning(vacancyId), ...rest };
}

/**
 * One invitation, under the locks: the vacancy must still be open, and the applicant still free with no pending row
 * on the pool entry and no application at this vacancy. → "invited" | "skipped" | "closed".
 */
async function invite(actorId, vacancy, vacancyId, candidate, matching) {
  try {
    return await withTransaction(actorId, async (client) => {
      const locked = await lockVacancy(client, vacancyId); // 1. job_vacancy
      if (locked?.status !== VACANCY_STATUS.OPEN) return "closed";
      await lockApplicant(client, candidate.applicantId); // 2. applicant (pool entry)
      if (!(await isPoolEntryActive(client, candidate.talentPoolId))) return "skipped";
      if (await findBlocking(candidate.applicantId, client)) return "skipped"; // BR-17: applied elsewhere meanwhile
      if (await findPendingOffer(candidate.talentPoolId, client)) return "skipped"; // one pending row per entry
      if (await hasApplied(candidate.applicantId, vacancyId, client)) return "skipped";

      const row = await insertInvitation(client, {
        talentPoolId: candidate.talentPoolId,
        vacancyId,
        invitedBy: actorId,
        dueAt: await responseDueAt(client),
        applicantType: candidate.applicantType,
        matching,
        matchingScore: matching.matchingScore,
      });
      await setPoolAvailability(client, candidate.talentPoolId, POOL_AVAILABILITY.INVITED);
      await notify(client, {
        userId: candidate.userId,
        type: N.JOB_INVITATION,
        vars: { jobTitle: vacancy.jobTitle, dueAt: row.dueAt },
        requiresAction: true,
      });
      return "invited";
    });
  } catch (error) {
    if (error.code === "23505") return "skipped"; // the one-pending index or the (entry, vacancy) key answered first
    throw error;
  }
}

/**
 * The run (decision 17c/d). Exported for tests; production code calls startPoolMatching.
 * @returns {Promise<{ invited: number, skipped: number, failed: number, finishedAt: string } | null>} null when the
 *   vacancy is not open
 */
export async function runPoolMatching(actorId, vacancyId) {
  const vacancy = await findVacancyForApply(vacancyId);
  if (vacancy?.status !== VACANCY_STATUS.OPEN) return null;
  const candidates = await listPoolCandidates(vacancyId);
  const counts = { invited: 0, skipped: 0, failed: 0 };

  for (const candidate of candidates) {
    const screen = prescreen(candidate, vacancy); // RANK-01, before any svc call
    if (!screen.passed) {
      counts.skipped++; // RANK-05 "prescreen": svc is never called for a prescreen failure
      continue;
    }
    const weights = resolveMatchingWeights(candidate.applicantType, vacancy); // MAT-04, the source application's type
    let match;
    try {
      match = await matchResume(
        { sections: candidate.sections, job: { skills: vacancy.requiredSkills, experience: vacancy.experienceRequirement ?? "" }, weights },
        { timeoutMs: POOL_MATCH_TIMEOUT_MS },
      );
    } catch (error) {
      logger.warn({ vacancyId, talentPoolId: candidate.talentPoolId, code: error.code }, "pool matching: svc call failed");
      counts.failed++;
      continue;
    }
    const matchingScore = storedMatchingScore(match.matchScore); // RANK-02 rounding, the stored value
    if (invitationExclusion({ prescreenPassed: screen.passed, matchingScore, matchingThreshold: vacancy.matchingThreshold })) {
      counts.skipped++;
      continue;
    }
    const outcome = await invite(actorId, vacancy, vacancyId, candidate, { match, weights, matchingScore });
    if (outcome === "closed") break; // the job left "open" during the run: no more invitations
    counts[outcome]++;
  }

  const summary = { ...counts, finishedAt: new Date().toISOString() };
  await withTransaction(actorId, async (client) => {
    await setPoolMatchSummary(client, vacancyId, summary);
    await notifyStaff(client, {
      type: N.HR_POOL_MATCHING_FINISHED,
      vars: { jobTitle: vacancy.jobTitle, ...counts },
      linkPath: `/admin/vacancies/${vacancyId}`,
    });
  });
  return summary;
}

// ---------------------------------------------------------------- applicant answer

/** Re-checks everything the run assumed, under the vacancy and applicant locks. → the resume id, or null to expire. */
async function recheckInvitation(client, { offer, vacancy, locked, userId }) {
  if (!offer.poolActive) return null; // the pool entry was replaced (a later application ended)
  if (locked.status !== VACANCY_STATUS.OPEN) return null;
  if (locked.applicationCount >= locked.applicationCap) return null; // FR-APP-07: the cap is full
  if (await findBlocking(offer.applicantId, client)) return null; // BR-17
  if (await isAtFailedCompany(offer.vacancyId, userId, client)) return null; // BR-19, 1 year
  if (await hasApplied(offer.applicantId, offer.vacancyId, client)) return null; // BR-14
  const applicant = await findApplicantForApply(userId, client);
  if (!applicant?.resumeId || !prescreen(applicant, vacancy).passed) return null; // RANK-01 (the profile may have changed)
  if (!meetsThreshold(offer.matchingScore, vacancy.matchingThreshold)) return null; // RANK-02, current threshold
  return applicant.resumeId;
}

const DUPLICATES = {
  application_one_ongoing_per_applicant: "You already have an ongoing application. Refresh the page.",
  application_applicant_id_job_vacancy_id_key: "You already applied for this job.",
};

/**
 * Accept or decline a job invitation (called by POST /api/applicant/offers/:id/accept | /decline after the rematch
 * service found a job_invitation row owned by this applicant). Never the company or a score in the answer.
 * @param {"accept"|"decline"} answer
 */
export async function answerInvitation(userId, found, answer) {
  const staffVars = { applicantName: found.applicantName, jobTitle: found.jobTitle, companyName: found.companyName };
  let result;
  try {
    result = await withTransaction(userId, async (client) => {
      const locked = await lockVacancy(client, found.vacancyId); // 1. job_vacancy
      await lockApplicant(client, found.applicantId); // 2. applicant (pool entry, BR-17)
      const offer = await findOffer(found.offerId, client); // re-read under the locks
      if (!locked || !offer || offer.status !== IS.PENDING) {
        throw conflict(offer?.status === IS.EXPIRED ? "This job is no longer available." : "You already answered this invitation. Refresh the page.");
      }

      if (answer === "decline") {
        if (!(await setOfferStatus(client, offer.offerId, IS.PENDING, IS.DECLINED))) throw conflict("You already answered this invitation.");
        await setPoolAvailability(client, offer.talentPoolId, POOL_AVAILABILITY.AVAILABLE);
        await notifyStaff(client, { type: N.HR_INVITATION_DECLINED, vars: staffVars, linkPath: `/admin/vacancies/${offer.vacancyId}` });
        return { offerId: offer.offerId, status: IS.DECLINED };
      }

      const vacancy = await findVacancyForApply(offer.vacancyId, client);
      const resumeId = await recheckInvitation(client, { offer, vacancy, locked, userId });
      if (!resumeId) {
        // Committed on purpose (no throw inside the transaction): the invitation ends, the applicant is told neutrally.
        if (!(await setOfferStatus(client, offer.offerId, IS.PENDING, IS.EXPIRED))) throw conflict("You already answered this invitation.");
        await setPoolAvailability(client, offer.talentPoolId, POOL_AVAILABILITY.AVAILABLE);
        await notify(client, { userId, type: N.JOB_INVITATION_EXPIRED, vars: { jobTitle: offer.jobTitle } });
        return { offerId: offer.offerId, status: IS.EXPIRED };
      }

      // 3. a normal application (BR-20 exception, answer 7: the matching computed at publish for this resume)
      assertInitial(A.WAITING_POOL, APPLICATION_SOURCE.TALENT_POOL);
      const applicationId = await insertApplication(client, {
        applicantId: offer.applicantId,
        vacancyId: offer.vacancyId,
        resumeId,
        applicantType: offer.applicantType,
        status: A.WAITING_POOL,
        reason: "Accepted job invitation",
        source: APPLICATION_SOURCE.TALENT_POOL,
      });
      await insertMatchingResult(client, applicationId, { ...offer.matching, matchingScore: offer.matchingScore });
      if (!(await setOfferStatus(client, offer.offerId, IS.PENDING, IS.ACCEPTED, applicationId))) {
        throw conflict("You already answered this invitation.");
      }
      await closePoolEntry(client, offer.talentPoolId);

      const vars = { jobTitle: offer.jobTitle };
      const { promoted } = await refreshShortlist(client, offer.vacancyId, offer.applicantType);
      const shortlisted = promoted.includes(applicationId);
      await notify(client, { userId, type: shortlisted ? N.SHORTLISTED : N.APPLICATION_SUBMITTED, applicationId, vars });
      // FR-APP-07: this application took the last qualified place → the job closes and its other invitations end.
      if (locked.applicationCount + 1 >= locked.applicationCap) {
        await setVacancyStatus(client, offer.vacancyId, assertVacancyTransition(locked.status, "close"), { closed: true });
        await expireJobInvitations(client, offer.vacancyId);
      }
      await notifyStaff(client, { type: N.HR_INVITATION_ACCEPTED, applicationId, vars: staffVars, linkPath: "/admin/screening" });
      return {
        offerId: offer.offerId,
        status: IS.ACCEPTED,
        applicationId,
        applicationStatus: shortlisted ? A.SHORTLISTED : A.WAITING_POOL,
        message: messageFor(shortlisted ? N.SHORTLISTED : N.APPLICATION_SUBMITTED, vars).message,
      };
    });
  } catch (error) {
    if (error.code === "23505" && DUPLICATES[error.constraint]) throw conflict(DUPLICATES[error.constraint]);
    throw error;
  }

  if (result.status === IS.EXPIRED) throw conflict("This job is no longer available. You can apply to other jobs.");
  return result;
}
