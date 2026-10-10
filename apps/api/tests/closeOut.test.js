// Close-out of a filled or archived vacancy (PRD BR-22; S15, decided Oct 10, 2026; TC-79): which statuses move
// where, pool entries, cancelled attempts and requests, neutral notices, system actor + reason, lock order.
import { APPLICATION_OUTCOME, APPLICATION_STATUS as A, BLOCKS_APPLYING_STATUSES } from "@vera/shared";
import { describe, expect, it } from "vitest";

import { CLOSE_OUT_REASON, closeOutTarget, closeOutVacancy, countEndorsed } from "../src/domain/closeOut.js";

const VACANCY = "66666666-6666-4666-8666-666666666666";

/** A fake transaction client over a list of applications (stale-read safe updates like the real SQL). */
function fakeClient(applications, { actor = "hr-1" } = {}) {
  const calls = [];
  const client = {
    calls,
    query: async (sql, params = []) => {
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      if (flat.startsWith('select application_id as "applicationId", applicant_id as "applicantId" from public.application')) {
        const wanted = params[1];
        return {
          rows: applications
            .filter((a) => wanted.includes(a.status))
            .sort((x, y) => x.applicationId.localeCompare(y.applicationId))
            .map(({ applicationId, applicantId }) => ({ applicationId, applicantId })),
        };
      }
      if (flat.startsWith("select applicant_id from public.applicant")) return { rows: [] };
      if (flat.includes("for update of a")) {
        return {
          rows: applications
            .filter((a) => params[0].includes(a.applicationId))
            .sort((x, y) => x.applicationId.localeCompare(y.applicationId))
            .map((a) => ({ applicationId: a.applicationId, applicantId: a.applicantId, status: a.status, userId: `u-${a.applicationId}` })),
        };
      }
      if (flat.startsWith('select job_title as "jobTitle"')) return { rows: [{ jobTitle: "Store Crew" }] };
      if (flat.includes("current_setting('vera.actor_id'")) return { rows: [{ actor }] };
      if (flat.startsWith("update public.application set status = $3")) {
        const app = applications.find((a) => a.applicationId === params[0]);
        if (!app || app.status !== params[1]) return { rows: [], rowCount: 0 };
        app.status = params[2];
        return { rows: [], rowCount: 1 };
      }
      if (flat.includes('as "endorsed"')) return { rows: [{ endorsed: applications.filter((a) => a.status === A.ENDORSED).length }] };
      return { rows: [], rowCount: 1 };
    },
  };
  return client;
}

const app = (applicationId, status, applicantId = `p-${applicationId}`) => ({ applicationId, applicantId, status });
const sqlOf = (client, start) => client.calls.filter((c) => c.sql.startsWith(start));

describe("closeOutTarget (BR-22)", () => {
  it("waiting, shortlisted (locked or not), and interview stages → not_selected", () => {
    for (const s of [A.WAITING_POOL, A.SHORTLISTED, A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED]) expect(closeOutTarget(s)).toBe(A.NOT_SELECTED);
  });

  it("passed, notified, or confirmed but not endorsed → standby (decided Oct 10)", () => {
    for (const s of [A.PASSED, A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT]) expect(closeOutTarget(s)).toBe(A.STANDBY);
  });

  it("endorsed (client decision pending), hired, and every final status stay", () => {
    for (const s of [A.ENDORSED, A.HIRED, A.DID_NOT_PASS, A.DROPPED, A.ARCHIVED, A.NOT_SELECTED, A.STANDBY, A.PRESCREEN_FAILED]) {
      expect(closeOutTarget(s)).toBeNull();
    }
  });

  it("not_selected and standby are neutral (no company block) and not ongoing (BR-17: the applicant is free)", () => {
    expect(APPLICATION_OUTCOME.NEUTRAL).toEqual(expect.arrayContaining([A.NOT_SELECTED, A.STANDBY]));
    expect(APPLICATION_OUTCOME.FAILED).not.toContain(A.NOT_SELECTED);
    expect(APPLICATION_OUTCOME.FAILED).not.toContain(A.STANDBY);
    expect(BLOCKS_APPLYING_STATUSES).not.toContain(A.NOT_SELECTED);
    expect(BLOCKS_APPLYING_STATUSES).not.toContain(A.STANDBY);
    expect(BLOCKS_APPLYING_STATUSES).toContain(A.PASSED); // sanity: the list is the ongoing set
  });
});

describe("closeOutVacancy", () => {
  it("TC-79: moves each open application, writes pool entries and neutral notices, as the system with the reason", async () => {
    const apps = [
      app("a1", A.WAITING_POOL),
      app("a2", A.SHORTLISTED),
      app("a3", A.INTERVIEW_SCHEDULED),
      app("a4", A.PASSED),
      app("a5", A.PASSED_AWAITING_CONFIRMATION),
      app("a6", A.ENDORSED),
      app("a7", A.DID_NOT_PASS),
    ];
    const client = fakeClient(apps);
    await expect(closeOutVacancy(client, VACANCY, "archived")).resolves.toEqual({ notSelected: ["a1", "a2", "a3"], standby: ["a4", "a5"] });

    expect(apps.map((a) => [a.applicationId, a.status])).toEqual([
      ["a1", A.NOT_SELECTED],
      ["a2", A.NOT_SELECTED],
      ["a3", A.NOT_SELECTED],
      ["a4", A.STANDBY],
      ["a5", A.STANDBY],
      ["a6", A.ENDORSED],
      ["a7", A.DID_NOT_PASS],
    ]);

    const moves = sqlOf(client, "update public.application set status = $3");
    expect(moves.map((m) => m.params)).toEqual([
      ["a1", A.WAITING_POOL, A.NOT_SELECTED, CLOSE_OUT_REASON.archived],
      ["a2", A.SHORTLISTED, A.NOT_SELECTED, CLOSE_OUT_REASON.archived],
      ["a3", A.INTERVIEW_SCHEDULED, A.NOT_SELECTED, CLOSE_OUT_REASON.archived],
      ["a4", A.PASSED, A.STANDBY, CLOSE_OUT_REASON.archived],
      ["a5", A.PASSED_AWAITING_CONFIRMATION, A.STANDBY, CLOSE_OUT_REASON.archived],
    ]);
    expect(CLOSE_OUT_REASON.archived).toBe("close-out: vacancy archived");

    // system actor: cleared before the first move, restored after the last one
    const clear = client.calls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    const firstMove = client.calls.findIndex((c) => c.sql.startsWith("update public.application set status = $3"));
    const restore = client.calls.findIndex((c) => c.sql === "select set_config('vera.actor_id', $1, true)" && c.params[0] === "hr-1");
    expect(clear).toBeGreaterThan(-1);
    expect(firstMove).toBeGreaterThan(clear);
    expect(restore).toBeGreaterThan(client.calls.findLastIndex((c) => c.sql.startsWith("update public.application set status = $3")));

    // pool entries (old active entry closed first, per applicant), with the right reason
    const inserts = sqlOf(client, "insert into public.talent_pool");
    expect(inserts.map((c) => c.params)).toEqual([
      ["p-a1", "a1", "not_selected"],
      ["p-a2", "a2", "not_selected"],
      ["p-a3", "a3", "not_selected"],
      ["p-a4", "a4", "standby"],
      ["p-a5", "a5", "standby"],
    ]);
    expect(sqlOf(client, "update public.talent_pool set removed_at = now()")).toHaveLength(5);

    // notices: not_selected for the first three, moved_to_standby for the passed ones
    const notices = sqlOf(client, "insert into public.notification");
    expect(notices.map((n) => [n.params[1], n.params[2]])).toEqual([
      ["a1", "not_selected"],
      ["a2", "not_selected"],
      ["a3", "not_selected"],
      ["a4", "moved_to_standby"],
      ["a5", "moved_to_standby"],
    ]);
    for (const n of notices) expect(`${n.params[3]} ${n.params[4]}`).not.toMatch(/claygo|kabayan|company|score|%|status_reason/i);

    // open attempts and pending requests of not-selected applications are cancelled; deadlines cleared for all moves
    const attempts = sqlOf(client, "update public.interview_schedule set status = $2::public.interview_status");
    expect(attempts.map((c) => c.params[0])).toEqual(["a1", "a2", "a3"]);
    expect(attempts[0].params.slice(1)).toEqual(["cancelled", ["pending_confirmation", "confirmed"]]);
    const requests = sqlOf(client, "update public.document_request set status = $2::public.request_status");
    expect(requests.map((c) => c.params)).toEqual([
      ["a1", "cancelled", "pending"],
      ["a2", "cancelled", "pending"],
      ["a3", "cancelled", "pending"],
    ]);
    expect(sqlOf(client, "update public.application set action_due_at = null").map((c) => c.params[0])).toEqual(["a1", "a2", "a3", "a4", "a5"]);
  });

  it("locks level by level: every applicant (ascending id) before every application (ascending id)", async () => {
    const apps = [app("b2", A.WAITING_POOL, "p-9"), app("b1", A.PASSED, "p-3"), app("b3", A.SHORTLISTED, "p-3")];
    const client = fakeClient(apps);
    await closeOutVacancy(client, VACANCY, "filled");

    const applicantLock = client.calls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    const applicationLock = client.calls.findIndex((c) => c.sql.includes("for update of a"));
    expect(applicantLock).toBeGreaterThan(-1);
    expect(applicationLock).toBeGreaterThan(applicantLock);
    expect(client.calls[applicantLock].sql).toMatch(/where applicant_id = any\(\$1::uuid\[\]\) order by applicant_id for update$/);
    expect(client.calls[applicantLock].params).toEqual([["p-3", "p-9"]]);
    expect(client.calls[applicationLock].sql).toMatch(/where a\.application_id = any\(\$1::uuid\[\]\) order by a\.application_id for update of a$/);
    expect(client.calls[applicationLock].params).toEqual([["b1", "b2", "b3"]]);
    // no application row is moved before both lock statements ran
    const firstMove = client.calls.findIndex((c) => c.sql.startsWith("update public.application set status = $3"));
    expect(firstMove).toBeGreaterThan(applicationLock);
    // the fill reason (S16 hook)
    expect(sqlOf(client, "update public.application set status = $3")[0].params[3]).toBe("close-out: vacancy filled");
  });

  it("reads the open applications with a typed status array", async () => {
    const client = fakeClient([app("c1", A.WAITING_POOL)]);
    await closeOutVacancy(client, VACANCY, "archived");
    const read = client.calls[0];
    expect(read.sql).toMatch(/where job_vacancy_id = \$1::uuid and status = any\(\$2::public\.application_status\[\]\) order by application_id$/);
    expect(read.params[1]).toEqual([
      A.WAITING_POOL, A.SHORTLISTED, A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED,
      A.PASSED, A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT,
    ]);
  });

  it("nothing open: no locks beyond the caller's, no writes", async () => {
    const client = fakeClient([app("d1", A.HIRED), app("d2", A.DID_NOT_PASS)]);
    await expect(closeOutVacancy(client, VACANCY, "archived")).resolves.toEqual({ notSelected: [], standby: [] });
    expect(client.calls).toHaveLength(1);
  });

  it("rejects an unknown cause before touching anything", async () => {
    const client = fakeClient([app("e1", A.WAITING_POOL)]);
    await expect(closeOutVacancy(client, VACANCY, "closed")).rejects.toThrow(/Unknown close-out cause/);
    expect(client.calls).toHaveLength(0);
  });

  it("countEndorsed counts endorsed applications with a typed status parameter", async () => {
    const client = fakeClient([app("f1", A.ENDORSED), app("f2", A.PASSED)]);
    await expect(countEndorsed(client, VACANCY)).resolves.toBe(1);
    expect(client.calls[0].sql).toMatch(/where job_vacancy_id = \$1::uuid and status = \$2::public\.application_status$/);
    expect(client.calls[0].params).toEqual([VACANCY, A.ENDORSED]);
  });
});
