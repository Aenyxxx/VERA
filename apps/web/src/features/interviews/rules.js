import { INTERVIEW_STATUS } from "@vera/shared";

// Mirrors apps/api/src/domain/interview.js so buttons are only enabled when the API would allow the action.
// The API re-checks under its locks; a race still answers 409, shown to the user.

const passed = (iso, now) => new Date(iso).getTime() <= now.getTime();

/**
 * Mark no-show (FR-INT-05 simplified): not confirmed → once the confirmation deadline or the interview time
 * passed; confirmed → once the interview time passed.
 * @returns {{ allowed: boolean, reason: string|null }} reason explains a disabled button
 */
export function noShowState(interview, now = new Date()) {
  if (interview.status === INTERVIEW_STATUS.PENDING_CONFIRMATION) {
    return passed(interview.confirmDueAt, now) || passed(interview.scheduledAt, now)
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "Available after the confirmation deadline" };
  }
  if (interview.status === INTERVIEW_STATUS.CONFIRMED) {
    return passed(interview.scheduledAt, now)
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "Available after the interview time" };
  }
  return { allowed: false, reason: "This interview is closed" };
}

/**
 * Evaluate (FR-INT-06, S14): only a confirmed interview whose start time has passed. Mirrors the API's check
 * (scheduled_at <= now() under the locks), which stays the real guard.
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function evaluateState(interview, now = new Date()) {
  if (interview.status === INTERVIEW_STATUS.PENDING_CONFIRMATION) {
    return { allowed: false, reason: "Evaluate after the applicant confirms" };
  }
  if (interview.status === INTERVIEW_STATUS.CONFIRMED) {
    return passed(interview.scheduledAt, now)
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "Available after the interview time" };
  }
  return { allowed: false, reason: "This interview is closed" };
}
