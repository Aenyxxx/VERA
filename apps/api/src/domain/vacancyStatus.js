// Vacancy status changes that HR triggers (APP_FLOW §5.2). Automatic ones (cap reached → closed,
// first endorsement → endorsing, hired = slots → filled) are added with S11/S16.
import { VACANCY_STATUS as V } from "@vera/shared";

import { AppError } from "../lib/errors.js";

/** action → { from: statuses it may start from, to: resulting status } */
export const VACANCY_ACTIONS = Object.freeze({
  publish: { from: [V.DRAFT], to: V.OPEN },
  close: { from: [V.OPEN], to: V.CLOSED },
  reopen: { from: [V.CLOSED, V.ENDORSING], to: V.OPEN },
  archive: { from: [V.DRAFT, V.CLOSED], to: V.ARCHIVED },
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
