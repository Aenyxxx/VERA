// Ranking, Notify, and the applicant's endorsement answer (S15; PRD FR-END-01, FR-END-03/04, BR-15, BR-23 capacity;
// TC-50, TC-52): roles, places left, statuses re-checked under the locks, lock order, actors, the fixed deadline
// line, no company in the message, and confirm / decline.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { notifyMessageDefault } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_VACANCY = "12121212-1212-4212-8212-121212121212";
const A1 = "a1a1a1a1-0000-4000-8000-000000000001";
const A2 = "a2a2a2a2-0000-4000-8000-000000000002";
const A3 = "a3a3a3a3-0000-4000-8000-000000000003";

const manila = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

let role;
let vacancy; // findRankingVacancy row
let vacancyLocked; // lockVacancy row (null = unknown vacancy)
let evaluated; // listEvaluatedApplications rows (pg strings)
let apps; // application rows by id: { vacancyId, status, userId }
let answerRow; // findApplicationForAnswer row
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const notifyCall = (body) => call("post", `/api/admin/vacancies/${VACANCY_ID}/notify`).send(body);
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const appMoves = () => txSql("update public.application set status = $3");
const dueWrites = () => txSql("update public.application set action_due_at = $2::timestamptz");
const notices = () => txSql("insert into public.notification");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const lockSequence = () =>
  txCalls.filter((c) => /for update( of a)?$/.test(c.sql)).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  vacancy = {
    vacancyId: VACANCY_ID,
    jobTitle: "Cashier",
    companyName: "Kabayan Mart",
    status: "open",
    slotsNeeded: 2,
    endorsementCount: 2,
    committed: 0,
  };
  vacancyLocked = { status: "open" };
  evaluated = [
    { applicationId: A1, applicantType: "experienced", status: "passed", appliedAt: "2026-10-08T01:00:00Z", actionDueAt: null, applicantName: "Ana Cruz", matchingScore: "79.31", interviewScore: "77.50", finalScore: "78.41", passingScore: "75.00", passed: true, overallRating: 4, reused: false },
    { applicationId: A2, applicantType: "first_time", status: "passed", appliedAt: "2026-10-08T02:00:00Z", actionDueAt: null, applicantName: "Ben Reyes", matchingScore: "87.50", interviewScore: "77.50", finalScore: "82.50", passingScore: "75.00", passed: true, overallRating: 4, reused: false },
    { applicationId: A3, applicantType: "experienced", status: "did_not_pass", appliedAt: "2026-10-08T03:00:00Z", actionDueAt: null, applicantName: "Cora Lim", matchingScore: "60.00", interviewScore: "50.00", finalScore: "55.00", passingScore: "75.00", passed: false, overallRating: 3, reused: true },
  ];
  apps = {
    [A1]: { vacancyId: VACANCY_ID, status: "passed", userId: "u-a1" },
    [A2]: { vacancyId: VACANCY_ID, status: "passed", userId: "u-a2" },
    [A3]: { vacancyId: VACANCY_ID, status: "did_not_pass", userId: "u-a3" },
  };
  answerRow = { applicationId: A1, vacancyId: VACANCY_ID, status: "passed_awaiting_confirmation", userId: USER_ID, applicantName: "Ana Cruz", jobTitle: "Cashier" };
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes('as "committed"')) return { rows: vacancyLocked ? [{ ...vacancy }] : [] };
    if (sql.includes('as "reused"')) return { rows: evaluated };
    if (sql.includes('v.job_title as "jobTitle"') && sql.includes("where a.application_id = $1::uuid")) return { rows: answerRow ? [answerRow] : [] };
    return { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: vacancyLocked ? [vacancyLocked] : [] };
    if (sql.includes('as "committed"')) return { rows: [{ ...vacancy }] };
    if (sql.includes("for update of a")) {
      return {
        rows: params[0]
          .filter((id) => apps[id])
          .sort()
          .map((id) => ({ applicationId: id, vacancyId: apps[id].vacancyId, status: apps[id].status, userId: apps[id].userId })),
      };
    }
    if (sql.includes("from public.application where application_id = $1 for update")) {
      const a = apps[params[0]];
      return { rows: a ? [{ applicationId: params[0], applicantId: "p1", vacancyId: a.vacancyId, applicantType: "experienced", status: a.status }] : [] };
    }
    if (sql.includes("from public.system_setting")) return { rows: [{ days: 3 }] };
    // statusMachine.transition: update ... where status = $2
    if (sql.includes("update public.application") && sql.includes("set status = $3")) {
      const a = apps[params[0]];
      if (!a || a.status !== params[1]) return { rows: [], rowCount: 0 };
      a.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
});

// ---------------------------------------------------------------- ranking

describe("GET /api/admin/vacancies/:id/ranking (FR-END-01, FR-VAC-06; TC-50)", () => {
  it("ranks every evaluated application of both groups with numbers, places left, and canNotify", async () => {
    const res = await call("get", `/api/admin/vacancies/${VACANCY_ID}/ranking`);
    expect(res.status).toBe(200);
    expect(res.body.data.ranking.map((r) => [r.rank, r.applicantName, r.finalScore, r.status])).toEqual([
      [1, "Ben Reyes", 82.5, "passed"],
      [2, "Ana Cruz", 78.41, "passed"],
      [3, "Cora Lim", 55, "did_not_pass"],
    ]);
    expect(res.body.data.ranking[0]).toMatchObject({ matchingScore: 87.5, interviewScore: 77.5, overallRating: 4, applicantType: "first_time" });
    expect(res.body.data.ranking[2].reused).toBe(true);
    expect(res.body.data.vacancy).toMatchObject({ endorsementCount: 2, committed: 0, notifyRemaining: 2, canNotify: true, companyName: "Kabayan Mart" });
  });

  it("places left = endorsement count − (notified + confirmed + endorsed), never below 0 (BR-23 definition)", async () => {
    vacancy.committed = 3;
    const res = await call("get", `/api/admin/vacancies/${VACANCY_ID}/ranking`);
    expect(res.body.data.vacancy.notifyRemaining).toBe(0);
    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes('as "committed"'));
    expect(sql).toMatch(/a\.status = any\(\$2::public\.application_status\[\]\)/);
    expect(params[1]).toEqual(["passed_awaiting_confirmation", "for_endorsement", "endorsed"]);
  });

  it("an archived vacancy is listed but cannot notify", async () => {
    vacancy.status = "archived";
    expect((await call("get", `/api/admin/vacancies/${VACANCY_ID}/ranking`)).body.data.vacancy.canNotify).toBe(false);
  });

  it("applicants get 403; an unknown vacancy 404", async () => {
    role = "applicant";
    expect((await call("get", `/api/admin/vacancies/${VACANCY_ID}/ranking`)).status).toBe(403);
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(403);
    role = "hr";
    vacancyLocked = null;
    expect((await call("get", `/api/admin/vacancies/${VACANCY_ID}/ranking`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------- notify

describe("POST /api/admin/vacancies/:id/notify (FR-END-03; TC-52)", () => {
  it("notifies the selected passed applicants: passed_awaiting_confirmation, deadline from the setting, fixed deadline line", async () => {
    const before = Date.now();
    const res = await notifyCall({ applicationIds: [A2, A1] });
    expect(res.status).toBe(200);
    expect(res.body.data.notified).toEqual([A1, A2].sort());
    expect(res.body.data.remaining).toBe(0);

    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]); // DATABASE_SCHEMA §8, no applicant lock needed
    const appLock = txSql("for update of a")[0];
    expect(appLock.sql).toMatch(/where a\.application_id = any\(\$1::uuid\[\]\) order by a\.application_id for update of a$/);
    expect(appLock.params).toEqual([[A1, A2].sort()]);

    expect(appMoves().map((m) => m.params)).toEqual(
      [A1, A2].sort().map((id) => [id, "passed", "passed_awaiting_confirmation", "Notified for endorsement"]),
    );
    // action_due_at = now + 3 days (system_setting), the same instant on both rows
    const dues = dueWrites();
    expect(dues).toHaveLength(2);
    const dueAt = new Date(dues[0].params[1]);
    expect(dueAt.getTime()).toBeGreaterThanOrEqual(before + 3 * 24 * 3600 * 1000 - 1000);
    expect(dueAt.getTime()).toBeLessThanOrEqual(Date.now() + 3 * 24 * 3600 * 1000 + 1000);
    expect(dues[1].params[1]).toEqual(dues[0].params[1]);

    const [first] = notices();
    expect(first.params.slice(1, 4)).toEqual([[A1, A2].sort()[0], "passed_confirm_endorsement", "Please confirm: Cashier"]);
    const expectedLine = `Please confirm on your dashboard by ${manila.format(dueAt)} (Philippine time).`;
    expect(first.params[4]).toBe(`${notifyMessageDefault("Cashier")} ${expectedLine}`);
    expect(first.params[4].match(/\(Philippine time\)/g)).toHaveLength(1);
    expect(first.params[6]).toBe(true); // requires action
    expect(`${first.params[3]} ${first.params[4]}`).not.toMatch(/kabayan|company|score|78\.41|%|hired|congratulations|!/i);
  });

  it("HR's edited body is used; the deadline line is still appended by the server", async () => {
    const message = "You did well in the assessment for Cashier. Tell us if you want to go forward.";
    await notifyCall({ applicationIds: [A1], message });
    const [note] = notices();
    expect(note.params[4].startsWith(`${message} Please confirm on your dashboard by `)).toBe(true);
    expect(note.params[4].endsWith(" (Philippine time).")).toBe(true);
  });

  it("a message naming the company (any case) → 422 with the field, nothing written", async () => {
    const res = await notifyCall({ applicationIds: [A1], message: "You will be endorsed to KABAYAN mart next week." });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Remove the company name: applicants never see the client company.");
    expect(res.body.error.details).toEqual([{ path: "message", message: "Remove the company name" }]);
    expect(writes()).toEqual([]);
  });

  it("more applicants than places left → 422, nothing written (endorsement 2, one already committed)", async () => {
    vacancy.committed = 1;
    const res = await notifyCall({ applicationIds: [A1, A2] });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Only 1 more applicant can be notified (endorsement count 2).");
    expect(writes()).toEqual([]);
  });

  it("a selected application that is not passed → 409, nothing written", async () => {
    const res = await notifyCall({ applicationIds: [A1, A3] });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Only passed applicants can be notified. Refresh the ranking.");
    expect(writes()).toEqual([]);
  });

  it("an application of another vacancy, or an unknown one → 404, nothing written", async () => {
    apps[A2].vacancyId = OTHER_VACANCY;
    expect((await notifyCall({ applicationIds: [A1, A2] })).status).toBe(404);
    expect((await notifyCall({ applicationIds: ["99999999-9999-4999-8999-999999999999"] })).status).toBe(404);
    expect(writes()).toEqual([]);
  });

  it("a filled or archived vacancy → 409; an unknown vacancy → 404", async () => {
    vacancy.status = "archived";
    const res = await notifyCall({ applicationIds: [A1] });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This vacancy is archived; its applicants can no longer be notified.");
    vacancyLocked = null;
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(404);
    expect(writes()).toEqual([]);
  });

  it("validation: no applicant, a duplicate, or a too-short message → 400", async () => {
    expect((await notifyCall({ applicationIds: [] })).status).toBe(400);
    expect((await notifyCall({ applicationIds: [A1, A1] })).status).toBe(400);
    expect((await notifyCall({ applicationIds: [A1], message: "short" })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("notifying the same applicant twice → the second gets 409 (now passed_awaiting_confirmation)", async () => {
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(200);
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(409);
    expect(appMoves()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- applicant answer

describe("POST /api/applicant/applications/:id/endorsement/confirm | decline (FR-END-04; TC-52)", () => {
  beforeEach(() => {
    role = "applicant";
    apps[A1].status = "passed_awaiting_confirmation";
  });
  const answer = (decision) => call("post", `/api/applicant/applications/${A1}/endorsement/${decision}`);

  it("confirm → for_endorsement as the applicant; deadline cleared; staff notified; no company or scores returned", async () => {
    const res = await answer("confirm");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicationId: A1, status: "for_endorsement" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // the applicant is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]);
    expect(appMoves()[0].params).toEqual([A1, "passed_awaiting_confirmation", "for_endorsement", "Applicant confirmed the endorsement"]);
    expect(dueWrites()[0].params).toEqual([A1, null]);
    const staff = txSql("from public.user_account where role = any($1::public.user_role[])");
    expect(staff[0].params.slice(2, 5)).toEqual([A1, "hr_endorsement_confirmed", "Endorsement confirmed: Ana Cruz"]);
    expect(staff[0].params[6]).toBe(`/admin/vacancies/${VACANCY_ID}`);
  });

  it("decline → archived (neutral, BR-15): no pool entry, staff notified", async () => {
    const res = await answer("decline");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicationId: A1, status: "archived" });
    expect(appMoves()[0].params.slice(1)).toEqual(["passed_awaiting_confirmation", "archived", "Applicant declined the endorsement"]);
    expect(txSql("public.talent_pool")).toEqual([]);
    const staff = txSql("from public.user_account where role = any($1::public.user_role[])");
    expect(staff[0].params[3]).toBe("hr_endorsement_declined");
  });

  it("confirm twice → 409 'You already confirmed this endorsement.'", async () => {
    expect((await answer("confirm")).status).toBe(200);
    const second = await answer("confirm");
    expect(second.status).toBe(409);
    expect(second.body.error.message).toBe("You already confirmed this endorsement.");
  });

  it("a close-out that won the lock (now standby) → 409 for both answers, nothing written", async () => {
    apps[A1].status = "standby";
    expect((await answer("confirm")).status).toBe(409);
    expect((await answer("decline")).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("someone else's application → 404; HR cannot use the applicant route", async () => {
    answerRow.userId = "someone-else";
    expect((await answer("confirm")).status).toBe(404);
    role = "hr";
    expect((await answer("confirm")).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
