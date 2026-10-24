// Application status changes (docs/APP_FLOW.md §5.1). Every status write goes through here (CLAUDE.md rule 1).
// The status-history trigger records each change with vera.actor_id (null = system) and status_reason.
import { APPLICATION_SOURCE, APPLICATION_STATUS as A } from "@vera/shared";

import { AppError, conflict } from "../lib/errors.js";

/**
 * Statuses a new application row may start in ([*] → … in APP_FLOW §5.1). Every application, including one
 * whose ratings will be reused (BR-21), starts with prescreen and fresh matching (BR-20).
 */
export const INITIAL_STATUSES = Object.freeze([
  A.PRESCREEN_FAILED, // prescreen fails
  A.BELOW_THRESHOLD, // score < threshold
  A.WAITING_POOL, // score ≥ threshold
]);

/**
 * from → statuses it may move to (APP_FLOW §5.1).
 * There is no "→ terminated" any more: with one ongoing application per applicant (BR-17) nothing else can be
 * active when an interview is confirmed. The enum value stays for old rows.
 */
const MOVES = {
  [A.WAITING_POOL]: [A.SHORTLISTED, A.NOT_SELECTED], // shortlist refresh; vacancy filled/archived (BR-22)
  [A.SHORTLISTED]: [
    A.WAITING_POOL, // displaced (not locked)
    A.DROPPED,
    A.INTERVIEW_CONFIRMED, // decision 37: HR schedules → the interview is set (notify only, no applicant confirmation)
    A.PASSED, // reused ratings (BR-21) after verification
    A.DID_NOT_PASS, // reused ratings (BR-21) after verification
    A.NOT_SELECTED, // vacancy filled/archived (BR-22), locked or not
  ],
  // Old rows only (before decision 37 the applicant confirmed): an approved reschedule sets the interview
  // (→ interview_confirmed); HR can still mark a no-show, and the close-out moves them.
  [A.INTERVIEW_SCHEDULED]: [A.INTERVIEW_CONFIRMED, A.DROPPED, A.NOT_SELECTED],
  [A.INTERVIEW_CONFIRMED]: [A.DROPPED, A.PASSED, A.DID_NOT_PASS, A.NOT_SELECTED], // decision 37: the interview is set
  // Decision 37B: Notify moves passed applicants straight to for_endorsement (no applicant confirmation).
  [A.PASSED]: [A.FOR_ENDORSEMENT, A.STANDBY],
  // Old rows only (before decision 37 the applicant confirmed): the close-out still moves them (BR-22).
  [A.PASSED_AWAITING_CONFIRMATION]: [A.STANDBY],
  [A.FOR_ENDORSEMENT]: [
    A.ENDORSED,
    A.STANDBY, // vacancy filled/archived before the endorsement (BR-22)
    A.ARCHIVED, // decision 37B: HR "Remove from endorsement" (neutral: no pool entry, no company block)
  ],
  // Decision 37C: endorsed → final interview → for training → for requirements → for orientation → hired (Deployed).
  // Not hired at every step before Deployed; training failed only at for training; a fill while the client has not
  // decided moves the applicant to standby (BR-22; never at archive).
  [A.ENDORSED]: [
    A.FINAL_INTERVIEW_SCHEDULED, // HR encodes the client's final interview (decision 14)
    A.NOT_HIRED, // the client declined before the final interview
    A.STANDBY,
  ],
  [A.FINAL_INTERVIEW_SCHEDULED]: [A.FOR_TRAINING, A.NOT_HIRED, A.STANDBY], // proceed / did not proceed / filled
  [A.FOR_TRAINING]: [A.FOR_REQUIREMENTS, A.TRAINING_FAILED, A.NOT_HIRED, A.STANDBY],
  [A.FOR_REQUIREMENTS]: [A.FOR_ORIENTATION, A.NOT_HIRED, A.STANDBY],
  [A.FOR_ORIENTATION]: [A.HIRED, A.NOT_HIRED, A.STANDBY], // Deployed
  [A.FOR_HIRING]: [A.HIRED, A.NOT_HIRED, A.STANDBY], // old rows only (decision 15)
  // hired (Deployed) is final: training failed now happens before it (decision 37C)
};

export const ALLOWED = Object.freeze(
  Object.fromEntries(
    Object.values(A).map((from) => {
      return [from, Object.freeze([...(MOVES[from] ?? [])])];
    }),
  ),
);

export function canTransition(from, to) {
  return ALLOWED[from]?.includes(to) ?? false;
}

/**
 * Throws 409 BUSINESS_RULE unless a new application may start in `status`. An accepted rematch offer (source
 * `rematch`, PRD BR-23, S17) starts at for_endorsement, and only there: no shortlist, screening, or interview.
 */
export function assertInitial(status, source = APPLICATION_SOURCE.DIRECT) {
  const allowed = source === APPLICATION_SOURCE.REMATCH ? [A.FOR_ENDORSEMENT] : INITIAL_STATUSES;
  if (!allowed.includes(status)) {
    throw new AppError(409, "BUSINESS_RULE", `An application cannot start as ${status}.`);
  }
}

/** Throws 409 BUSINESS_RULE unless `from → to` is in ALLOWED. */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new AppError(409, "BUSINESS_RULE", `An application cannot move from ${from} to ${to}.`);
  }
}

/**
 * Moves one application to `toStatus`. The UPDATE only matches the status we read, so a change made by
 * someone else in the meantime is reported (409) instead of being overwritten.
 * @param {import("pg").PoolClient} client inside withTransaction
 * @param {{ applicationId: string, status: string }} application current row
 * @param {string} toStatus
 * @param {string|null} reason stored in status_reason and copied into the history row
 */
export async function transition(client, application, toStatus, reason = null) {
  assertTransition(application.status, toStatus);
  const { rowCount } = await client.query(
    `update public.application
        set status = $3, status_reason = $4
      where application_id = $1 and status = $2`,
    [application.applicationId, application.status, toStatus, reason],
  );
  if (rowCount !== 1) throw conflict("This application was changed by someone else. Refresh and try again.");
}
