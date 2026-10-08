// Interview scheduling rules (PRD FR-INT-02, FR-INT-05 simplified; ROADMAP S13, decided Oct 8, 2026).
// One open attempt per application; the application status and the attempt status move together:
//   interview_scheduled ↔ pending_confirmation, interview_confirmed ↔ confirmed.
// No automatic expiry: deadlines are shown, and HR marks a no-show once the deadline or the interview time passed.
import { APPLICATION_STATUS as A, INTERVIEW_STATUS as I } from "@vera/shared";

import { conflict } from "../lib/errors.js";

/** Attempt statuses that are still open (HR can edit them; at most one per application, DB index). */
export const OPEN_INTERVIEW_STATUSES = Object.freeze([I.PENDING_CONFIRMATION, I.CONFIRMED]);

/** The application status that belongs to each open attempt status. */
const APPLICATION_FOR = Object.freeze({
  [I.PENDING_CONFIRMATION]: A.INTERVIEW_SCHEDULED,
  [I.CONFIRMED]: A.INTERVIEW_CONFIRMED,
});

const changed = () => conflict("This interview was changed by someone else. Refresh and try again.");
const past = (date, now) => new Date(date).getTime() <= now.getTime();

/**
 * The applicant must confirm by now + response_deadline_days (BR-08, passed in as `responseDue`),
 * but never later than the interview itself.
 */
export function confirmDueAt(responseDue, scheduledAt) {
  return new Date(Math.min(new Date(responseDue).getTime(), new Date(scheduledAt).getTime()));
}

/**
 * Throws 409 unless the attempt is still open and matches its application's status.
 * Called under the application row lock, so a confirm and a no-show can never both pass.
 * @param {{ status: string } | null} attempt
 * @param {{ status: string } | null} application locked row
 */
export function assertOpen(attempt, application) {
  if (!attempt || !OPEN_INTERVIEW_STATUSES.includes(attempt.status)) {
    throw conflict("This interview is no longer open. Refresh the page.");
  }
  if (!application || APPLICATION_FOR[attempt.status] !== application.status) throw changed();
}

/** The applicant may confirm an attempt awaiting confirmation until the interview starts (the deadline is not enforced). */
export function assertCanConfirm(attempt, application, now = new Date()) {
  if (attempt?.status === I.CONFIRMED) throw conflict("You already confirmed this interview.");
  assertOpen(attempt, application);
  if (past(attempt.scheduledAt, now)) {
    throw conflict("The interview time has passed. Please contact Confiable Manpower.");
  }
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
