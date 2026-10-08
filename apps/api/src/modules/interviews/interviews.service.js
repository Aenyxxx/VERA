// Interview scheduling (PRD FR-INT-01/02/05; ROADMAP S13 simplified, decided Oct 8, 2026):
// HR schedules from the review sheet, the applicant confirms on the dashboard, HR edits the time or marks a no-show.
// No reschedule requests, no reminders, no automatic expiry (ROADMAP §6).
// Lock order in every transaction (DATABASE_SCHEMA §8): job_vacancy → applicant → application. The attempt row
// is written only under its application's lock. No svc calls here. Status changes only through
// statusMachine.transition; HR (or the applicant, for confirm) is the history actor.
import { APPLICATION_STATUS as A, INTERVIEW_STATUS as I, NOTIFICATION_TYPE as N } from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { assertCanConfirm, assertOpen, confirmDueAt, noShowOutcome } from "../../domain/interview.js";
import { notify, notifyStaff } from "../../domain/notify.js";
import { reusedRatingsSource } from "../../domain/reuse.js";
import { transition } from "../../domain/statusMachine.js";
import { isFullyVerified, responseDueAt } from "../../domain/verification.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { dropApplication } from "../screening/screening.service.js";
import {
  findApplicationForHr,
  findCurrentResume,
  listApplicationRequests,
  listCurrentDocumentsForHr,
  lockApplication,
} from "../screening/screening.repository.js";
import { lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  findInterview,
  insertInterview,
  isActiveInterviewer,
  listInterviewers,
  listInterviewsForHr,
  listMyInterviews,
  setInterviewStatus,
  updateInterview,
} from "./interviews.repository.js";

const notActiveInterviewer = () => businessRule("Choose an active HR or admin account as the interviewer.");

// ---------------------------------------------------------------- read

/** GET /api/admin/interviewers */
export async function getInterviewers() {
  return listInterviewers();
}

/** GET /api/admin/interviews?vacancyId= */
export async function getInterviewsForHr(query) {
  return listInterviewsForHr(query);
}

/** GET /api/applicant/interviews — job title only; the link once confirmed. */
export async function getMyInterviews(userId) {
  return listMyInterviews(userId);
}

// ---------------------------------------------------------------- write

/**
 * POST /api/admin/interviews { applicationId, scheduledAt, durationMinutes, meetingLink, interviewerId } (FR-INT-02).
 * Re-checked under the locks: still shortlisted, fully verified (FR-SCR-06), and no ratings on file (BR-21: those
 * applicants get Compute final score instead and are never interviewed again).
 */
export async function scheduleInterview(hrId, { applicationId, scheduledAt, durationMinutes, meetingLink, interviewerId }) {
  const app = await findApplicationForHr(applicationId);
  if (!app) throw notFound("Application not found.");
  try {
    return await withTransaction(hrId, async (client) => {
      await lockVacancy(client, app.vacancyId); // 1. job_vacancy (the shortlist refresh locks it too)
      const locked = await lockApplication(client, applicationId); // 3. application (no applicant row needed)
      if (!locked || locked.status !== A.SHORTLISTED) {
        throw conflict("Only a shortlisted application can be scheduled. Refresh the page.");
      }

      // One transaction client: sequential queries, never Promise.all.
      const resume = await findCurrentResume(locked.applicantId, client);
      const documents = await listCurrentDocumentsForHr(locked.applicantId, client);
      const requests = await listApplicationRequests(applicationId, client);
      const reusable = await reusedRatingsSource(client, locked.applicantId, applicationId);
      if (!isFullyVerified({ resume, documents, requests })) {
        throw businessRule("Verify the resume and every document before scheduling the interview.");
      }
      if (reusable) {
        throw businessRule("This applicant has ratings on file. Compute the final score with the reused ratings instead.");
      }
      if (!(await isActiveInterviewer(interviewerId, client))) throw notActiveInterviewer();

      const dueAt = confirmDueAt(await responseDueAt(client), scheduledAt);
      const interview = await insertInterview(client, {
        applicationId,
        interviewerId,
        scheduledAt,
        durationMinutes,
        meetingLink,
        confirmDueAt: dueAt,
        hrId,
      });
      await transition(client, locked, A.INTERVIEW_SCHEDULED); // HR is the history actor (vera.actor_id)
      await notify(client, {
        userId: app.userId,
        type: N.INTERVIEW_SCHEDULED,
        applicationId,
        vars: { jobTitle: app.jobTitle, scheduledAt, durationMinutes, confirmDueAt: dueAt },
        requiresAction: true,
      });
      return { ...interview, applicationId, applicationStatus: A.INTERVIEW_SCHEDULED };
    });
  } catch (error) {
    // Last line of defense for a double submit: one open attempt per application (DB index). Any other unique
    // violation is a real error and stays a 500.
    if (error.code === "23505" && error.constraint === "interview_one_open_per_application") {
      throw conflict("This application already has an interview. Refresh the page.");
    }
    throw error;
  }
}

/**
 * PATCH /api/admin/interviews/:id — HR edits the open attempt in place (ROADMAP S13: no applicant reschedule
 * requests). A confirmed attempt stays confirmed; one still awaiting confirmation gets a new deadline.
 */
export async function editInterview(hrId, interviewId, { scheduledAt, durationMinutes, meetingLink, interviewerId }) {
  const found = await findInterview(interviewId);
  if (!found) throw notFound("Interview not found.");
  return withTransaction(hrId, async (client) => {
    await lockVacancy(client, found.vacancyId); // 1. job_vacancy
    const locked = await lockApplication(client, found.applicationId); // 3. application
    const attempt = await findInterview(interviewId, client); // re-read under the application lock
    assertOpen(attempt, locked);
    if (!(await isActiveInterviewer(interviewerId, client))) throw notActiveInterviewer();

    const pending = attempt.status === I.PENDING_CONFIRMATION;
    const dueAt = pending ? confirmDueAt(await responseDueAt(client), scheduledAt) : null;
    const updated = await updateInterview(client, interviewId, { interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt: dueAt });
    if (!updated) throw conflict("This interview is no longer open. Refresh the page.");
    await notify(client, {
      userId: found.userId,
      type: N.INTERVIEW_RESCHEDULED,
      applicationId: found.applicationId,
      vars: { jobTitle: found.jobTitle, scheduledAt, durationMinutes, confirmDueAt: dueAt },
      requiresAction: pending,
    });
    return updated;
  });
}

/**
 * POST /api/applicant/interviews/:id/confirm — the applicant confirms (FR-INT-02). Not their interview → 404.
 * The deadline is shown but not enforced; the interview time is (APP_FLOW §3.3, decided Oct 8, 2026).
 */
export async function confirmInterview(userId, interviewId) {
  const found = await findInterview(interviewId);
  if (!found || found.userId !== userId) throw notFound("Interview not found.");
  return withTransaction(userId, async (client) => {
    await lockVacancy(client, found.vacancyId); // 1. job_vacancy
    const locked = await lockApplication(client, found.applicationId); // 3. application
    const attempt = await findInterview(interviewId, client); // re-read under the application lock
    assertCanConfirm(attempt, locked); // a no-show that won the lock → 409 here

    if (!(await setInterviewStatus(client, interviewId, I.PENDING_CONFIRMATION, I.CONFIRMED))) {
      throw conflict("This interview was changed by someone else. Refresh and try again.");
    }
    await transition(client, locked, A.INTERVIEW_CONFIRMED); // the applicant is the history actor
    await notifyStaff(client, {
      type: N.HR_INTERVIEW_CONFIRMED,
      applicationId: found.applicationId,
      vars: { applicantName: found.applicantName, jobTitle: found.jobTitle, scheduledAt: attempt.scheduledAt },
      linkPath: "/admin/interviews",
    });
    return { interviewId, status: I.CONFIRMED, applicationStatus: A.INTERVIEW_CONFIRMED };
  });
}

/**
 * POST /api/admin/interviews/:id/no-show — FR-INT-05 simplified: HR marks it, nothing expires by itself.
 * Uses the S12 drop service (same locks, notification, refill, and HR attribution): the check below runs under
 * its locks, re-checks the attempt (a confirm that won the lock → 409) and closes the attempt.
 */
export async function markNoShow(hrId, interviewId) {
  const found = await findInterview(interviewId);
  if (!found) throw notFound("Interview not found.");
  let interviewStatus;
  const result = await dropApplication(hrId, found.applicationId, null, async (client, locked) => {
    const attempt = await findInterview(interviewId, client); // re-read under the application lock
    const { attemptStatus, drop } = noShowOutcome(attempt, locked);
    if (!(await setInterviewStatus(client, interviewId, attempt.status, attemptStatus))) {
      throw conflict("This interview was changed by someone else. Refresh and try again.");
    }
    interviewStatus = attemptStatus;
    return drop;
  });
  return { interviewId, interviewStatus, ...result };
}
