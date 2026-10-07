// Application status changes (docs/APP_FLOW.md §5.1). Every status write goes through here (CLAUDE.md rule 1).
// The status-history trigger records each change with vera.actor_id (null = system) and status_reason.
import { ACTIVE_APPLICATION_STATUSES, APPLICATION_STATUS as A } from "@vera/shared";

import { AppError, conflict } from "../lib/errors.js";

/** Statuses a new application row may start in ([*] → … in APP_FLOW §5.1). */
export const INITIAL_STATUSES = Object.freeze([
  A.PRESCREEN_FAILED, // prescreen fails
  A.BELOW_THRESHOLD, // score < threshold
  A.WAITING_POOL, // score ≥ threshold (direct)
  A.PASSED, // talent pool, verified, reused ratings ≥ passing (S17)
  A.DID_NOT_PASS, // talent pool, verified, reused ratings < passing (S17)
  A.SHORTLISTED, // talent pool, verification reset (S17)
]);

/** from → statuses it may move to (APP_FLOW §5.1). "Any active → terminated" is added below. */
const MOVES = {
  [A.WAITING_POOL]: [A.SHORTLISTED], // shortlist refresh
  [A.SHORTLISTED]: [A.WAITING_POOL, A.DROPPED, A.INTERVIEW_SCHEDULED, A.PASSED, A.DID_NOT_PASS], // waiting_pool = displaced (not locked)
  [A.INTERVIEW_SCHEDULED]: [A.INTERVIEW_CONFIRMED, A.DROPPED],
  [A.INTERVIEW_CONFIRMED]: [A.DROPPED, A.PASSED, A.DID_NOT_PASS],
  [A.PASSED]: [A.PASSED_AWAITING_CONFIRMATION, A.STANDBY],
  [A.PASSED_AWAITING_CONFIRMATION]: [A.FOR_ENDORSEMENT, A.ARCHIVED],
  [A.FOR_ENDORSEMENT]: [A.ENDORSED],
  [A.ENDORSED]: [A.HIRED, A.NOT_HIRED],
  [A.HIRED]: [A.TRAINING_FAILED],
};

export const ALLOWED = Object.freeze(
  Object.fromEntries(
    Object.values(A).map((from) => {
      const to = [...(MOVES[from] ?? [])];
      // Confirming an interview elsewhere terminates every other active application (BR-10).
      if (ACTIVE_APPLICATION_STATUSES.includes(from)) to.push(A.TERMINATED);
      return [from, Object.freeze(to)];
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
