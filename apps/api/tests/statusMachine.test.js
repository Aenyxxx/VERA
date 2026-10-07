// Application state machine (docs/APP_FLOW.md §5.1, CLAUDE.md rule 1).
import { ACTIVE_APPLICATION_STATUSES, APPLICATION_STATUS as A } from "@vera/shared";
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
  it("allows the apply-time starting statuses", () => {
    for (const s of [A.PRESCREEN_FAILED, A.BELOW_THRESHOLD, A.WAITING_POOL]) expect(() => assertInitial(s)).not.toThrow();
    expect(INITIAL_STATUSES).toContain(A.PASSED); // talent pool (S17)
    expect(() => assertInitial(A.HIRED)).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
  });

  it("has the shortlist moves: waiting_pool → shortlisted and shortlisted → waiting_pool (displaced)", () => {
    expect(canTransition(A.WAITING_POOL, A.SHORTLISTED)).toBe(true);
    expect(canTransition(A.SHORTLISTED, A.WAITING_POOL)).toBe(true);
  });

  it("follows the documented pipeline", () => {
    expect(canTransition(A.SHORTLISTED, A.INTERVIEW_SCHEDULED)).toBe(true);
    expect(canTransition(A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED)).toBe(true);
    expect(canTransition(A.INTERVIEW_CONFIRMED, A.PASSED)).toBe(true);
    expect(canTransition(A.PASSED, A.PASSED_AWAITING_CONFIRMATION)).toBe(true);
    expect(canTransition(A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT)).toBe(true);
    expect(canTransition(A.FOR_ENDORSEMENT, A.ENDORSED)).toBe(true);
    expect(canTransition(A.ENDORSED, A.HIRED)).toBe(true);
    expect(canTransition(A.HIRED, A.TRAINING_FAILED)).toBe(true);
  });

  it("rejects moves that are not documented", () => {
    expect(canTransition(A.WAITING_POOL, A.INTERVIEW_SCHEDULED)).toBe(false);
    expect(canTransition(A.PRESCREEN_FAILED, A.WAITING_POOL)).toBe(false);
    expect(canTransition(A.BELOW_THRESHOLD, A.SHORTLISTED)).toBe(false);
    expect(() => assertTransition(A.HIRED, A.WAITING_POOL)).toThrow(
      expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }),
    );
  });

  it("lets every active status (and only those) be terminated", () => {
    for (const s of Object.values(A)) {
      expect(canTransition(s, A.TERMINATED)).toBe(ACTIVE_APPLICATION_STATUSES.includes(s));
    }
    expect(Object.keys(ALLOWED)).toHaveLength(Object.values(A).length);
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
