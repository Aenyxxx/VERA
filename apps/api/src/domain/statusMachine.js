// Application status changes (docs/APP_FLOW.md §5.1). Every status write goes through here (CLAUDE.md rule 1).
// The status-history trigger records each change with vera.actor_id (null = system) and status_reason.
import { APPLICATION_STATUS as A } from "@vera/shared";

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
    A.INTERVIEW_SCHEDULED,
    A.PASSED, // reused ratings (BR-21) after verification
    A.DID_NOT_PASS, // reused ratings (BR-21) after verification
    A.NOT_SELECTED, // vacancy filled/archived (BR-22), locked or not
  ],
  [A.INTERVIEW_SCHEDULED]: [A.INTERVIEW_CONFIRMED, A.DROPPED, A.NOT_SELECTED],
  [A.INTERVIEW_CONFIRMED]: [A.DROPPED, A.PASSED, A.DID_NOT_PASS, A.NOT_SELECTED],
  [A.PASSED]: [A.PASSED_AWAITING_CONFIRMATION, A.STANDBY],
  [A.PASSED_AWAITING_CONFIRMATION]: [
    A.FOR_ENDORSEMENT, // applicant confirms (FR-END-04)
    A.ARCHIVED, // applicant declines (BR-15)
    A.STANDBY, // vacancy filled/archived before the endorsement (BR-22, decided Oct 10)
  ],
  [A.FOR_ENDORSEMENT]: [A.ENDORSED, A.STANDBY], // standby: vacancy filled/archived before the endorsement (BR-22)
  [A.ENDORSED]: [
    A.HIRED,
    A.NOT_HIRED,
    A.STANDBY, // vacancy filled while the client had not decided (BR-22, S16, decided Oct 10); never at archive
  ],
  [A.HIRED]: [A.TRAINING_FAILED],
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

/** Throws 409 BUSINESS_RULE unless a new application may start in `status`. */
export function assertInitial(status) {
  if (!INITIAL_STATUSES.includes(status)) {
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
