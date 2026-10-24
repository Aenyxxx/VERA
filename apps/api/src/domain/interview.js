// Interview scheduling rules (PRD FR-INT-02, FR-INT-05 simplified; ROADMAP S13, decided Oct 8, 2026).
// One open attempt per application; the application status and the attempt status move together:
//   interview_scheduled ↔ pending_confirmation, interview_confirmed ↔ confirmed.
// Decision 37 (Oct 24): notify only. HR's schedule (or an approved reschedule) is set at once: attempt `confirmed`,
// application interview_confirmed; the applicant never confirms. pending_confirmation / interview_scheduled exist
// only on old rows (HR can still edit them or mark a no-show). HR marks a no-show once the interview time passed.
// Phase 4 (decision 20): the applicant may ask for a reschedule (max 2 requests per application, approved or
// declined); HR approves with a new time (a new attempt) or declines (the attempt goes back as it was).
import { APPLICATION_STATUS as A, INTERVIEW_STATUS as I } from "@vera/shared";

import { businessRule, conflict } from "../lib/errors.js";

/** Attempt statuses that are still open (HR can edit them; pending_confirmation only on old rows). */
export const OPEN_INTERVIEW_STATUSES = Object.freeze([I.PENDING_CONFIRMATION, I.CONFIRMED]);

/**
 * Attempts still in play: the open ones plus a reschedule request waiting for HR (= the DB index
 * interview_one_open_per_application). Lists, the dashboard, and the close-out use these.
 */
export const LIVE_INTERVIEW_STATUSES = Object.freeze([...OPEN_INTERVIEW_STATUSES, I.RESCHEDULE_REQUESTED]);

/** interview_schedule.attempt_number is 1..3 (DB check): at most 2 reschedules, whatever the setting says. */
export const MAX_RESCHEDULE_REQUESTS = 2;

/** The application status that belongs to each open attempt status. */
const APPLICATION_FOR = Object.freeze({
  [I.PENDING_CONFIRMATION]: A.INTERVIEW_SCHEDULED,
  [I.CONFIRMED]: A.INTERVIEW_CONFIRMED,
});

const changed = () => conflict("This interview was changed by someone else. Refresh and try again.");
const past = (date, now) => new Date(date).getTime() <= now.getTime();

/**
 * Throws 409 unless the attempt is still open and matches its application's status.
 * Called under the application row lock, so a confirm and a no-show can never both pass.
 * @param {{ status: string } | null} attempt
 * @param {{ status: string } | null} application locked row
 */
export function assertOpen(attempt, application, requestedMessage = "Answer the reschedule request first.") {
  if (attempt?.status === I.RESCHEDULE_REQUESTED) throw conflict(requestedMessage);
  if (!attempt || !OPEN_INTERVIEW_STATUSES.includes(attempt.status)) {
    throw conflict("This interview is no longer open. Refresh the page.");
  }
  if (!application || APPLICATION_FOR[attempt.status] !== application.status) throw changed();
}

/**
 * Mark no-show (FR-INT-05, simplified: HR acts instead of the expiry job).
 * - Not confirmed: allowed once the confirmation deadline or the interview time passed → attempt expired,
 *   drop reason no_response.
 * - Confirmed: allowed once the interview time passed → attempt no_show, drop reason other + "No-show"
 *   (there is no no_show drop reason).
 * Otherwise 409. Returns the attempt status to store and the drop input for the S12 drop service.
 * @returns {{ attemptStatus: string, drop: { reason: string, remarks: string|null } }}
 */
export function noShowOutcome(attempt, application, now = new Date()) {
  assertOpen(attempt, application);
  if (attempt.status === I.PENDING_CONFIRMATION) {
    if (!past(attempt.confirmDueAt, now) && !past(attempt.scheduledAt, now)) {
      throw conflict("The applicant can still confirm. Mark a no-show after the confirmation deadline.");
    }
    return { attemptStatus: I.EXPIRED, drop: { reason: "no_response", remarks: null } };
  }
  if (!past(attempt.scheduledAt, now)) {
    throw conflict("The interview has not started yet. Mark a no-show after the interview time.");
  }
  return { attemptStatus: I.NO_SHOW, drop: { reason: "other", remarks: "No-show" } };
}

/** Requests left for an application: the setting (max_reschedules, default 2) capped by MAX_RESCHEDULE_REQUESTS. */
export function rescheduleRequestsLeft(used, setting = MAX_RESCHEDULE_REQUESTS) {
  const max = Math.min(Number.isFinite(setting) && setting >= 0 ? setting : MAX_RESCHEDULE_REQUESTS, MAX_RESCHEDULE_REQUESTS);
  return Math.max(max - used, 0);
}

/**
 * The applicant may ask for a reschedule (decision 20, FR-INT-03) while the attempt is open (awaiting confirmation or
 * confirmed) and before the interview starts, with requests left. Called under the application row lock.
 */
export function assertCanRequestReschedule(attempt, application, { used, setting }, now = new Date()) {
  assertOpen(attempt, application, "Your reschedule request is waiting for the agency.");
  if (past(attempt.scheduledAt, now)) {
    throw conflict("The interview time has passed. Please contact Confiable Manpower.");
  }
  if (rescheduleRequestsLeft(used, setting) === 0) {
    throw businessRule("You have used both reschedule requests. Please contact Confiable Manpower.");
  }
}

/** HR answers only a waiting request (approve or decline). */
export function assertRescheduleRequested(attempt) {
  if (attempt?.status !== I.RESCHEDULE_REQUESTED) {
    throw conflict("There is no reschedule request to answer. Refresh the page.");
  }
}

/**
 * Declined request: the attempt goes back to the status that matches its application (the application status
 * never moved while the request waited): interview_scheduled → pending_confirmation, interview_confirmed → confirmed.
 */
export function statusAfterDecline(application) {
  const back = { [A.INTERVIEW_SCHEDULED]: I.PENDING_CONFIRMATION, [A.INTERVIEW_CONFIRMED]: I.CONFIRMED }[application?.status];
  if (!back) throw conflict("This interview was changed by someone else. Refresh and try again.");
  return back;
}
