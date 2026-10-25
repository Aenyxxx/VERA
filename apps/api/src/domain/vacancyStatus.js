// Vacancy status changes (APP_FLOW §5.2). HR triggers publish/close/reopen/archive; the apply flow (S11) closes an
// open vacancy automatically when its qualified applications reach the cap (same "close" move). The endorsement
// flow (S16) moves it by itself: Notify (decision 39-3) → endorsing, hired = slots → filled (SYSTEM_MOVES).
// Decision 40-3: a filled vacancy may be archived too. Its close-out already ran at the fill, so archiving it changes
// only the vacancy's status (the archive's close-out finds nobody to move).
import { VACANCY_STATUS as V } from "@vera/shared";

import { AppError } from "../lib/errors.js";

/** action → { from: statuses it may start from, to: resulting status } */
export const VACANCY_ACTIONS = Object.freeze({
  publish: { from: [V.DRAFT], to: V.OPEN },
  close: { from: [V.OPEN], to: V.CLOSED },
  reopen: { from: [V.CLOSED, V.ENDORSING], to: V.OPEN },
  archive: { from: [V.DRAFT, V.CLOSED, V.FILLED], to: V.ARCHIVED }, // decision 40-3: + filled
});

const VERBS = { publish: "published", close: "closed", reopen: "reopened", archive: "archived" };

/** Statuses after publishing: only posting text (and a higher cap) may change (PRD FR-VAC-03). */
export const PUBLISHED_EDITABLE_STATUSES = Object.freeze([V.OPEN, V.CLOSED, V.ENDORSING]);

export function canDo(status, action) {
  return VACANCY_ACTIONS[action]?.from.includes(status) ?? false;
}

/** @returns the new status; throws 409 BUSINESS_RULE when the action is not allowed from `status`. */
export function assertTransition(status, action) {
  if (!canDo(status, action)) {
    throw new AppError(409, "BUSINESS_RULE", `A ${status} vacancy cannot be ${VERBS[action] ?? action}.`);
  }
  return VACANCY_ACTIONS[action].to;
}

/**
 * Moves made by the endorsement flow, never HR buttons (S16, PRD FR-VAC-07, FR-END-09; decided Oct 10, 2026):
 * - endorse: Create endorsement on an open, closed, or already endorsing vacancy → endorsing;
 * - fill: hired = slots on an open, closed, or endorsing vacancy (HR may have reopened it) → filled, then close-out.
 */
export const SYSTEM_MOVES = Object.freeze({
  endorse: { from: [V.OPEN, V.CLOSED, V.ENDORSING], to: V.ENDORSING },
  fill: { from: [V.OPEN, V.CLOSED, V.ENDORSING], to: V.FILLED },
});

/** @returns the new status; throws 409 BUSINESS_RULE when the system move is not allowed from `status`. */
export function assertSystemMove(status, move) {
  if (!SYSTEM_MOVES[move]?.from.includes(status)) {
    throw new AppError(409, "BUSINESS_RULE", `A ${status} vacancy cannot be ${move === "fill" ? "filled" : "endorsed"}.`);
  }
  return SYSTEM_MOVES[move].to;
}
