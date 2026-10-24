// Application state machine (docs/APP_FLOW.md §5.1, CLAUDE.md rule 1).
import { APPLICATION_OUTCOME, APPLICATION_STATUS as A } from "@vera/shared";
import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED,
  assertInitial,
  assertTransition,
  canTransition,
  INITIAL_STATUSES,
  transition,
} from "../src/domain/statusMachine.js";

describe("statusMachine", () => {
  it("starts every application with prescreen and matching (BR-20): only the three apply-time statuses", () => {
    expect([...INITIAL_STATUSES]).toEqual([A.PRESCREEN_FAILED, A.BELOW_THRESHOLD, A.WAITING_POOL]);
    for (const s of [A.PASSED, A.DID_NOT_PASS, A.SHORTLISTED, A.HIRED]) {
      expect(() => assertInitial(s)).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
    }
  });

  it("an accepted rematch offer (source rematch, BR-23) starts at for_endorsement, and only there", () => {
    expect(assertInitial(A.FOR_ENDORSEMENT, "rematch")).toBe(undefined);
    for (const s of [...INITIAL_STATUSES, A.PASSED, A.ENDORSED, A.SHORTLISTED]) {
      expect(() => assertInitial(s, "rematch")).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
    }
    // a direct application can never start at for_endorsement
    expect(() => assertInitial(A.FOR_ENDORSEMENT)).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => assertInitial(A.FOR_ENDORSEMENT, "direct")).toThrow(expect.objectContaining({ status: 409 }));
    expect(assertInitial(A.WAITING_POOL, "direct")).toBe(undefined);
  });

  it("has the shortlist moves: waiting_pool → shortlisted and shortlisted → waiting_pool (displaced)", () => {
    expect(canTransition(A.WAITING_POOL, A.SHORTLISTED)).toBe(true);
    expect(canTransition(A.SHORTLISTED, A.WAITING_POOL)).toBe(true);
  });

  it("follows the documented pipeline", () => {
    expect(canTransition(A.SHORTLISTED, A.INTERVIEW_CONFIRMED)).toBe(true); // decision 37: HR schedules, set at once
    expect(canTransition(A.INTERVIEW_CONFIRMED, A.PASSED)).toBe(true);
    expect(canTransition(A.PASSED, A.FOR_ENDORSEMENT)).toBe(true); // decision 37B: Notify, no applicant confirmation
    expect(canTransition(A.FOR_ENDORSEMENT, A.ENDORSED)).toBe(true);
    expect(canTransition(A.ENDORSED, A.FINAL_INTERVIEW_SCHEDULED)).toBe(true); // decision 14
    expect(canTransition(A.FINAL_INTERVIEW_SCHEDULED, A.FOR_HIRING)).toBe(true); // decision 15
    expect(canTransition(A.FOR_HIRING, A.HIRED)).toBe(true);
    expect(canTransition(A.HIRED, A.TRAINING_FAILED)).toBe(true);
  });

  it("decision 37: no applicant confirmation; interview_scheduled is never entered again (old rows only)", () => {
    expect(ALLOWED[A.SHORTLISTED]).toEqual([A.WAITING_POOL, A.DROPPED, A.INTERVIEW_CONFIRMED, A.PASSED, A.DID_NOT_PASS, A.NOT_SELECTED]);
    expect(ALLOWED[A.INTERVIEW_CONFIRMED]).toEqual([A.DROPPED, A.PASSED, A.DID_NOT_PASS, A.NOT_SELECTED]);
    // old rows: an approved reschedule sets them (→ interview_confirmed); no-show and close-out still work
    expect(ALLOWED[A.INTERVIEW_SCHEDULED]).toEqual([A.INTERVIEW_CONFIRMED, A.DROPPED, A.NOT_SELECTED]);
    for (const s of Object.values(A)) expect(canTransition(s, A.INTERVIEW_SCHEDULED)).toBe(false);
  });

  it("decisions 14/15: hired only from for_hiring; not hired at every step with the client; no skipping", () => {
    expect(canTransition(A.ENDORSED, A.HIRED)).toBe(false);
    expect(canTransition(A.FINAL_INTERVIEW_SCHEDULED, A.HIRED)).toBe(false);
    expect(canTransition(A.ENDORSED, A.FOR_HIRING)).toBe(false);
    for (const s of [A.ENDORSED, A.FINAL_INTERVIEW_SCHEDULED, A.FOR_HIRING]) expect(canTransition(s, A.NOT_HIRED)).toBe(true);
    expect(ALLOWED[A.FINAL_INTERVIEW_SCHEDULED]).toEqual([A.FOR_HIRING, A.NOT_HIRED, A.STANDBY]);
    expect(ALLOWED[A.FOR_HIRING]).toEqual([A.HIRED, A.NOT_HIRED, A.STANDBY]);
    // decision 32: Create endorsement goes through endorsed (two history rows); the shortcut stays refused
    expect(canTransition(A.FOR_ENDORSEMENT, A.FINAL_INTERVIEW_SCHEDULED)).toBe(false);
    expect(ALLOWED[A.FOR_ENDORSEMENT]).toEqual([A.ENDORSED, A.STANDBY, A.ARCHIVED]);
    expect(() => assertTransition(A.ENDORSED, A.HIRED)).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
  });

  it("decision 37B: no applicant confirmation; passed_awaiting_confirmation is never entered again (old rows only)", () => {
    expect(ALLOWED[A.PASSED]).toEqual([A.FOR_ENDORSEMENT, A.STANDBY]);
    for (const s of Object.values(A)) expect(canTransition(s, A.PASSED_AWAITING_CONFIRMATION)).toBe(false);
    // old rows: only the close-out moves them; no confirm (for_endorsement) or decline (archived) any more
    expect(ALLOWED[A.PASSED_AWAITING_CONFIRMATION]).toEqual([A.STANDBY]);
    // HR "Remove from endorsement": for_endorsement → archived, and only from there
    expect(Object.values(A).filter((s) => canTransition(s, A.ARCHIVED))).toEqual([A.FOR_ENDORSEMENT]);
  });

  it("rejects moves that are not documented", () => {
    expect(canTransition(A.WAITING_POOL, A.INTERVIEW_SCHEDULED)).toBe(false);
    expect(canTransition(A.PRESCREEN_FAILED, A.WAITING_POOL)).toBe(false);
    expect(canTransition(A.BELOW_THRESHOLD, A.SHORTLISTED)).toBe(false);
    expect(() => assertTransition(A.HIRED, A.WAITING_POOL)).toThrow(
      expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }),
    );
  });

  it("never terminates: one ongoing application per applicant leaves nothing to terminate (BR-17)", () => {
    for (const s of Object.values(A)) expect(canTransition(s, A.TERMINATED)).toBe(false);
    expect(Object.keys(ALLOWED)).toHaveLength(Object.values(A).length);
  });

  it("closes out a filled or archived vacancy (BR-22): waiting, shortlisted, interview → not_selected; passed → standby", () => {
    for (const s of [A.WAITING_POOL, A.SHORTLISTED, A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED]) {
      expect(canTransition(s, A.NOT_SELECTED)).toBe(true);
    }
    expect(canTransition(A.PASSED, A.STANDBY)).toBe(true);
    expect(canTransition(A.PASSED, A.NOT_SELECTED)).toBe(false);
  });

  it("close-out also moves passed applicants who were notified or confirmed to standby; endorsed only at fill (S15/S16, decided Oct 10)", () => {
    expect(canTransition(A.PASSED_AWAITING_CONFIRMATION, A.STANDBY)).toBe(true);
    expect(canTransition(A.FOR_ENDORSEMENT, A.STANDBY)).toBe(true);
    // the client's final interview or decline (Phase 2); standby only when the vacancy fills first (S16; archive refuses)
    expect(ALLOWED[A.ENDORSED]).toEqual([A.FINAL_INTERVIEW_SCHEDULED, A.NOT_HIRED, A.STANDBY]);
    expect(ALLOWED[A.PASSED_AWAITING_CONFIRMATION]).toEqual([A.STANDBY]); // old rows only (decision 37B)
    expect(ALLOWED[A.FOR_ENDORSEMENT]).toEqual([A.ENDORSED, A.STANDBY, A.ARCHIVED]);
  });

  it("final statuses never move again, except hired → training_failed", () => {
    for (const s of [...APPLICATION_OUTCOME.FAILED, ...APPLICATION_OUTCOME.NEUTRAL]) expect(ALLOWED[s]).toEqual([]);
    expect(ALLOWED[A.HIRED]).toEqual([A.TRAINING_FAILED]);
  });

  it("transition updates only when the status is still the one read", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    await transition(client, { applicationId: "app-1", status: A.WAITING_POOL }, A.SHORTLISTED, "shortlist refresh");
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/where application_id = \$1 and status = \$2/);
    expect(params).toEqual(["app-1", A.WAITING_POOL, A.SHORTLISTED, "shortlist refresh"]);
  });

  it("transition reports a stale read as 409 CONFLICT", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(
      transition(client, { applicationId: "app-1", status: A.WAITING_POOL }, A.SHORTLISTED),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("transition never writes an illegal move", async () => {
    const client = { query: vi.fn() };
    await expect(transition(client, { applicationId: "a", status: A.HIRED }, A.SHORTLISTED)).rejects.toMatchObject({
      code: "BUSINESS_RULE",
    });
    expect(client.query).not.toHaveBeenCalled();
  });
});
