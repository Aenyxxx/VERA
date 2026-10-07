// RANK-02 threshold and shortlist (PRD BR-01, BR-05, BR-12; DATABASE_SCHEMA §6.2; TC-35, TC-36).
import { APPLICATION_STATUS as A } from "@vera/shared";
import { describe, expect, it, vi } from "vitest";

import { roundHundredths } from "../src/domain/round.js";
import {
  compareCandidates,
  meetsThreshold,
  refreshShortlist,
  selectShortlist,
  storedMatchingScore,
} from "../src/domain/shortlist.js";

const at = (minute) => `2026-10-10T08:${String(minute).padStart(2, "0")}:00.000Z`;
const app = (id, matchingScore, minute, status = A.WAITING_POOL) => ({ applicationId: id, matchingScore, appliedAt: at(minute), status });
const ids = (list) => list.map((c) => c.applicationId);

describe("rounding and threshold (RANK-02, BR-05)", () => {
  it("rounds half-up on the decimal value", () => {
    expect(roundHundredths(39.995)).toBe(40);
    expect(roundHundredths(39.994)).toBe(39.99);
    expect(roundHundredths(78.405)).toBe(78.41);
    expect(roundHundredths(79.31)).toBe(79.31);
    expect(roundHundredths(100)).toBe(100);
  });

  it("checks the threshold on the stored (rounded) score: 39.995 is stored as 40.00 and passes 40", () => {
    expect(meetsThreshold(storedMatchingScore(39.995), 40)).toBe(true);
    expect(meetsThreshold(storedMatchingScore(39.994), 40)).toBe(false);
  });

  it("passes at exactly the threshold and fails just below it", () => {
    expect(meetsThreshold(40, 40)).toBe(true);
    expect(meetsThreshold(39.99, 40)).toBe(false);
  });
});

describe("selectShortlist (RANK-02)", () => {
  it("TC-35: 6 experienced above threshold, slots 2 → top 4 shortlisted, 2 stay in the waiting pool", () => {
    const candidates = [app("a", 70, 1), app("b", 90, 2), app("c", 55, 3), app("d", 81, 4), app("e", 62, 5), app("f", 48, 6)];
    const { promote, demote } = selectShortlist({ quota: 4, occupied: 0, candidates });
    expect(ids(promote)).toEqual(["b", "d", "a", "e"]);
    expect(demote).toEqual([]);
  });

  it("breaks ties by earlier application, then by application id", () => {
    const candidates = [app("z", 80, 5), app("y", 80, 1), app("x2", 80, 3), app("x1", 80, 3)];
    expect(ids([...candidates].sort(compareCandidates))).toEqual(["y", "x1", "x2", "z"]);
    expect(ids(selectShortlist({ quota: 2, occupied: 0, candidates }).promote)).toEqual(["y", "x1"]);
  });

  it("TC-36: a locked slot uses the quota and a newcomer displaces only an unlocked applicant", () => {
    // Quota 4: #4 is locked (verification started), so it is not a candidate and counts as occupied.
    const candidates = [
      app("s1", 90, 1, A.SHORTLISTED),
      app("s2", 85, 2, A.SHORTLISTED),
      app("s3", 60, 3, A.SHORTLISTED),
      app("new", 75, 9),
    ];
    const { promote, demote } = selectShortlist({ quota: 4, occupied: 1, candidates });
    expect(ids(promote)).toEqual(["new"]);
    expect(ids(demote)).toEqual(["s3"]);
  });

  it("a newcomer below every unlocked shortlisted applicant waits", () => {
    const candidates = [app("s1", 90, 1, A.SHORTLISTED), app("new", 41, 9)];
    expect(selectShortlist({ quota: 1, occupied: 0, candidates })).toEqual({ promote: [], demote: [] });
  });

  it("promotes nobody when locked and past-screening applications fill the quota", () => {
    const candidates = [app("w", 99, 1)];
    expect(selectShortlist({ quota: 4, occupied: 4, candidates }).promote).toEqual([]);
    expect(selectShortlist({ quota: 4, occupied: 6, candidates }).promote).toEqual([]);
  });

  it("refills a freed slot from the waiting pool (BR-11)", () => {
    const candidates = [app("s1", 90, 1, A.SHORTLISTED), app("w1", 70, 2), app("w2", 65, 3)];
    expect(ids(selectShortlist({ quota: 2, occupied: 0, candidates }).promote)).toEqual(["w1"]);
  });
});

describe("refreshShortlist", () => {
  function fakeClient({ quota = 2, occupied = 0, candidates = [], actor = "user-1" } = {}) {
    const calls = [];
    const client = {
      calls,
      query: vi.fn(async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        if (sql.includes("for update")) return { rows: [{ quota, jobTitle: "Cashier" }] };
        if (sql.includes('as "occupied"')) return { rows: [{ occupied }] };
        if (sql.includes("join public.matching_result")) return { rows: candidates };
        if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor }] };
        return { rows: [], rowCount: 1 };
      }),
    };
    return client;
  }

  it("locks the vacancy row and only looks at direct applications of the group", async () => {
    const client = fakeClient();
    await refreshShortlist(client, "vac-1", "experienced");
    expect(client.calls[0].sql).toMatch(/from public\.job_vacancy where job_vacancy_id = \$1 for update/);
    expect(client.calls[1].params).toEqual(["vac-1", "experienced", "direct", A.SHORTLISTED, expect.arrayContaining([A.INTERVIEW_SCHEDULED, A.HIRED])]);
    expect(client.calls[2].params).toEqual(["vac-1", "experienced", "direct", A.WAITING_POOL, A.SHORTLISTED]);
  });

  it("writes nothing when nothing moves", async () => {
    const client = fakeClient({ candidates: [{ ...app("s1", 90, 1, A.SHORTLISTED), userId: "u1" }] });
    await expect(refreshShortlist(client, "vac-1", "first_time")).resolves.toEqual({ promoted: [], demoted: [] });
    expect(client.calls.some((c) => c.sql.startsWith("update"))).toBe(false);
  });

  it("moves applicants as the system: actor cleared, reason 'shortlist refresh', then actor restored", async () => {
    const client = fakeClient({
      quota: 1,
      candidates: [{ ...app("s1", 50, 1, A.SHORTLISTED), userId: "u1" }, { ...app("new", 80, 9), userId: "u2" }],
    });
    await expect(refreshShortlist(client, "vac-1", "experienced")).resolves.toEqual({ promoted: ["new"], demoted: ["s1"] });

    const sqls = client.calls.map((c) => c.sql);
    const clear = sqls.indexOf("select set_config('vera.actor_id', '', true)");
    const updates = client.calls.filter((c) => c.sql.startsWith("update public.application"));
    const restore = client.calls.findIndex((c) => c.sql.startsWith("select set_config('vera.actor_id', $1") && c.params[0] === "user-1");
    expect(clear).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(clear);
    expect(updates.map((u) => u.params)).toEqual([
      ["s1", A.SHORTLISTED, A.WAITING_POOL, "shortlist refresh"],
      ["new", A.WAITING_POOL, A.SHORTLISTED, "shortlist refresh"],
    ]);
    for (const u of updates) expect(client.calls.indexOf(u)).toBeGreaterThan(clear);

    // Transaction-local settings only (third argument true = SET LOCAL), never session-level.
    for (const c of client.calls.filter((call) => call.sql.includes("set_config"))) expect(c.sql).toMatch(/, true\)$/);

    // Both applicants are told: shortlisted ("Under review") and displaced (back to "Application received").
    const notices = client.calls.filter((c) => c.sql.startsWith("insert into public.notification"));
    expect(notices.map((n) => [n.params[0], n.params[2]])).toEqual([
      ["u1", "shortlist_displaced"],
      ["u2", "shortlisted"],
    ]);
  });

  it("restores the actor in finally when a move fails, and keeps the original error", async () => {
    const client = fakeClient({ quota: 1, candidates: [{ ...app("new", 80, 9), userId: "u2" }] });
    const base = client.query.getMockImplementation();
    client.query.mockImplementation(async (sql, params) => {
      if (sql.startsWith("update public.application")) return { rows: [], rowCount: 0 }; // stale read → 409
      return base(sql, params);
    });

    await expect(refreshShortlist(client, "vac-1", "experienced")).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(client.calls.at(-1)).toEqual({ sql: "select set_config('vera.actor_id', $1, true)", params: ["user-1"] });
  });

  it("a failing restore (aborted transaction) never hides the original error", async () => {
    const client = fakeClient({ quota: 1, candidates: [{ ...app("new", 80, 9), userId: "u2" }] });
    const base = client.query.getMockImplementation();
    client.query.mockImplementation(async (sql, params) => {
      if (sql.startsWith("update public.application")) throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
      if (sql.startsWith("select set_config('vera.actor_id', $1")) throw new Error("current transaction is aborted");
      return base(sql, params);
    });

    await expect(refreshShortlist(client, "vac-1", "experienced")).rejects.toMatchObject({ code: "40P01" });
  });
});
