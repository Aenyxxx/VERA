// Interview rules (S13, FR-INT-02/05 simplified): confirmation deadline, open-attempt checks, confirm, no-show.
import { describe, expect, it } from "vitest";

import {
  assertCanConfirm,
  assertCanRequestReschedule,
  assertOpen,
  assertRescheduleRequested,
  confirmDueAt,
  LIVE_INTERVIEW_STATUSES,
  noShowOutcome,
  rescheduleRequestsLeft,
  statusAfterDecline,
} from "../src/domain/interview.js";

const SCHEDULED_AT = "2026-10-12T02:00:00.000Z"; // Oct 12, 10:00 AM Philippine time
const DUE_AT = "2026-10-11T02:00:00.000Z";
const at = (iso) => new Date(iso);
const pending = { status: "pending_confirmation", scheduledAt: SCHEDULED_AT, confirmDueAt: DUE_AT };
const confirmed = { ...pending, status: "confirmed" };
const scheduledApp = { status: "interview_scheduled" };
const confirmedApp = { status: "interview_confirmed" };

const status409 = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.status;
  }
  return "no error";
};

describe("confirmDueAt", () => {
  it("is now + response_deadline_days when the interview is later", () => {
    expect(confirmDueAt("2026-10-11T02:00:00.000Z", SCHEDULED_AT).toISOString()).toBe("2026-10-11T02:00:00.000Z");
  });

  it("is never after the interview itself", () => {
    expect(confirmDueAt("2026-10-15T02:00:00.000Z", SCHEDULED_AT).toISOString()).toBe(SCHEDULED_AT);
  });
});

describe("assertOpen", () => {
  it("accepts an open attempt whose application status matches", () => {
    expect(() => assertOpen(pending, scheduledApp)).not.toThrow();
    expect(() => assertOpen(confirmed, confirmedApp)).not.toThrow();
  });

  it("refuses closed attempts and mismatched application statuses with 409", () => {
    for (const status of ["no_show", "expired", "cancelled", "completed"]) {
      expect(status409(() => assertOpen({ ...pending, status }, scheduledApp))).toBe(409);
    }
    expect(status409(() => assertOpen(null, scheduledApp))).toBe(409);
    expect(status409(() => assertOpen(pending, { status: "dropped" }))).toBe(409);
    expect(status409(() => assertOpen(confirmed, scheduledApp))).toBe(409);
  });
});

describe("assertCanConfirm", () => {
  it("allows confirming before the interview, even after the (unenforced) deadline", () => {
    expect(() => assertCanConfirm(pending, scheduledApp, at("2026-10-11T12:00:00.000Z"))).not.toThrow();
  });

  it("refuses a second confirm, a past interview time, and a dropped application (409)", () => {
    expect(status409(() => assertCanConfirm(confirmed, confirmedApp, at("2026-10-10T00:00:00.000Z")))).toBe(409);
    expect(status409(() => assertCanConfirm(pending, scheduledApp, at(SCHEDULED_AT)))).toBe(409);
    expect(status409(() => assertCanConfirm({ ...pending, status: "expired" }, { status: "dropped" }))).toBe(409);
  });
});

describe("noShowOutcome", () => {
  it("unconfirmed: 409 before the deadline, then expired + no_response", () => {
    expect(status409(() => noShowOutcome(pending, scheduledApp, at("2026-10-10T00:00:00.000Z")))).toBe(409);
    expect(noShowOutcome(pending, scheduledApp, at(DUE_AT))).toEqual({
      attemptStatus: "expired",
      drop: { reason: "no_response", remarks: null },
    });
  });

  it("unconfirmed: the interview time passing is enough even if the deadline was moved later", () => {
    const late = { ...pending, confirmDueAt: "2026-10-13T00:00:00.000Z" };
    expect(noShowOutcome(late, scheduledApp, at(SCHEDULED_AT)).attemptStatus).toBe("expired");
  });

  it("confirmed: 409 before the interview time (even past the deadline), then no_show + other/'No-show'", () => {
    expect(status409(() => noShowOutcome(confirmed, confirmedApp, at("2026-10-11T12:00:00.000Z")))).toBe(409);
    expect(noShowOutcome(confirmed, confirmedApp, at(SCHEDULED_AT))).toEqual({
      attemptStatus: "no_show",
      drop: { reason: "other", remarks: "No-show" },
    });
  });

  it("an attempt that is no longer open → 409", () => {
    expect(status409(() => noShowOutcome({ ...pending, status: "expired" }, { status: "dropped" }, at(SCHEDULED_AT)))).toBe(409);
  });
});

// Phase 4 (decision 20): reschedule requests, max 2 per application (approved or declined).
describe("reschedule requests", () => {
  const requested = { ...pending, status: "reschedule_requested" };
  const before = at("2026-10-10T02:00:00.000Z");
  const message = (fn) => {
    try {
      fn();
    } catch (error) {
      return [error.status, error.message];
    }
    return "no error";
  };

  it("LIVE = open attempts plus a waiting request (the one-open DB index)", () => {
    expect(LIVE_INTERVIEW_STATUSES).toEqual(["pending_confirmation", "confirmed", "reschedule_requested"]);
  });

  it("requests left: the setting capped at 2, never below 0", () => {
    expect([0, 1, 2, 3].map((used) => rescheduleRequestsLeft(used))).toEqual([2, 1, 0, 0]);
    expect(rescheduleRequestsLeft(0, 5)).toBe(2);
    expect(rescheduleRequestsLeft(0, 1)).toBe(1);
    expect(rescheduleRequestsLeft(0, 0)).toBe(0);
    expect(rescheduleRequestsLeft(0, Number.NaN)).toBe(2);
  });

  it("allowed from awaiting confirmation or confirmed, before the interview, with requests left", () => {
    expect(message(() => assertCanRequestReschedule(pending, scheduledApp, { used: 0, setting: 2 }, before))).toBe("no error");
    expect(message(() => assertCanRequestReschedule(confirmed, confirmedApp, { used: 1, setting: 2 }, before))).toBe("no error");
  });

  it("refused: 2 used (422), after the interview time (409), already waiting (409), attempt and application out of step (409)", () => {
    expect(message(() => assertCanRequestReschedule(pending, scheduledApp, { used: 2, setting: 2 }, before))).toEqual([
      422,
      "You have used both reschedule requests. Please contact Confiable Manpower.",
    ]);
    expect(message(() => assertCanRequestReschedule(pending, scheduledApp, { used: 0, setting: 2 }, at(SCHEDULED_AT)))).toEqual([
      409,
      "The interview time has passed. Please contact Confiable Manpower.",
    ]);
    expect(message(() => assertCanRequestReschedule(requested, scheduledApp, { used: 1, setting: 2 }, before))).toEqual([
      409,
      "Your reschedule request is waiting for the agency.",
    ]);
    expect(status409(() => assertCanRequestReschedule(confirmed, scheduledApp, { used: 0, setting: 2 }, before))).toBe(409);
  });

  it("a waiting request blocks HR edit / no-show and the applicant confirm with its own message", () => {
    expect(message(() => assertOpen(requested, scheduledApp))).toEqual([409, "Answer the reschedule request first."]);
    expect(message(() => noShowOutcome(requested, scheduledApp, at("2026-10-13T00:00:00.000Z")))).toEqual([
      409,
      "Answer the reschedule request first.",
    ]);
    expect(message(() => assertCanConfirm(requested, scheduledApp, before))).toEqual([409, "Your reschedule request is waiting for the agency."]);
  });

  it("HR answers only a waiting request; a decline goes back to the status that matches the application", () => {
    expect(message(() => assertRescheduleRequested(requested))).toBe("no error");
    expect(status409(() => assertRescheduleRequested(pending))).toBe(409);
    expect(status409(() => assertRescheduleRequested(null))).toBe(409);
    expect(statusAfterDecline(scheduledApp)).toBe("pending_confirmation");
    expect(statusAfterDecline(confirmedApp)).toBe("confirmed");
    expect(status409(() => statusAfterDecline({ status: "dropped" }))).toBe(409);
  });
});
