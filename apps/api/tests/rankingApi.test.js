// Ranking and Notify (S15; PRD FR-END-01, FR-END-03/05, BR-23 capacity; TC-50, TC-52; decision 37B: no applicant
// confirmation; decision 39-3: Notify = the endorsement): roles, places left, statuses re-checked under the locks,
// lock order, actors, the batch and its items with the final interview, passed / for_endorsement → endorsed → final
// interview, the ONE notice, the vacancy → endorsing (job invitations end), no company in the message, and the removed
// confirm / decline routes.
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
const ENDORSEMENT_ID = "e1e1e1e1-0000-4000-8000-000000000001";
const SENT_AT = "2026-10-12T06:00:00.000Z";
const OTHER_VACANCY = "12121212-1212-4212-8212-121212121212";
const A1 = "a1a1a1a1-0000-4000-8000-000000000001";
const A2 = "a2a2a2a2-0000-4000-8000-000000000002";
const A3 = "a3a3a3a3-0000-4000-8000-000000000003";

let role;
let vacancy; // findRankingVacancy row
let vacancyLocked; // lockVacancy row (null = unknown vacancy)
let evaluated; // listEvaluatedApplications rows (pg strings)
let apps; // application rows by id: { vacancyId, status, userId }
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
// Decision 32: every Notify carries the client's final interview (time in Manila, details); tests override it.
const SCHEDULE = { finalInterviewAt: "2026-10-16T09:30:00+08:00", finalInterviewDetails: "Bring two valid IDs." };
const SCHEDULE_LINE = "Final interview: Oct 16, 2026, 9:30 AM (Philippine time). Bring two valid IDs.";
const rawNotify = (body) => call("post", `/api/admin/vacancies/${VACANCY_ID}/notify`).send(body);
const notifyCall = (body) => rawNotify({ ...SCHEDULE, ...body });
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
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes('as "committed"')) return { rows: vacancyLocked ? [{ ...vacancy }] : [] };
    if (sql.includes('as "reused"')) return { rows: evaluated };
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
    if (sql.includes('as "reused"')) return { rows: evaluated }; // decision 39-3: ranks for the items, under the locks
    if (sql.replace(/\s+/g, " ").trim().startsWith("insert into public.endorsement ")) {
      return { rows: [{ endorsementId: ENDORSEMENT_ID, sentAt: SENT_AT }] };
    }
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
    expect(params[1]).toEqual([
      "passed_awaiting_confirmation", "for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring",
      "for_training", "for_requirements", "for_orientation", // decision 37C: still with the client, they keep a place
    ]);
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
  it("decision 39-3: one transaction endorses the selection as one batch with the final interview, ONE notice each, vacancy → endorsing", async () => {
    vacancyLocked = { status: "closed" };
    vacancy.status = "closed";
    const res = await notifyCall({ applicationIds: [A2, A1] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      endorsementId: ENDORSEMENT_ID,
      sentAt: SENT_AT,
      notified: [A1, A2].sort(),
      status: "final_interview_scheduled",
      vacancyStatus: "endorsing",
      remaining: 0,
    });

    expect(withTransaction.mock.calls).toHaveLength(1); // everything in ONE transaction
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]); // DATABASE_SCHEMA §8, no applicant lock needed
    const appLock = txSql("for update of a")[0];
    expect(appLock.sql).toMatch(/where a\.application_id = any\(\$1::uuid\[\]\) order by a\.application_id for update of a$/);
    expect(appLock.params).toEqual([[A1, A2].sort()]);

    // the batch (sent, by HR) and one item per applicant: RANK-03 rank, the stored final, the final interview
    const batches = txSql("insert into public.endorsement (");
    expect(batches).toHaveLength(1);
    expect(batches[0].params).toEqual([VACANCY_ID, "sent", USER_ID]);
    expect(batches[0].sql).toContain("select v.job_vacancy_id, v.company_id, $2::public.endorsement_status, $3::uuid, now()");
    expect(txSql("insert into public.endorsement_item").map((c) => c.params)).toEqual([
      [ENDORSEMENT_ID, A1, 2, 78.41, "2026-10-16T01:30:00.000Z", "Bring two valid IDs."],
      [ENDORSEMENT_ID, A2, 1, 82.5, "2026-10-16T01:30:00.000Z", "Bring two valid IDs."],
    ]);
    // the ranks are read under the locks, before the batch is written
    const rankRead = txCalls.findIndex((c) => c.sql.includes('as "reused"'));
    expect(rankRead).toBeGreaterThan(txCalls.findIndex((c) => c.sql.endsWith("for update of a")));
    expect(rankRead).toBeLessThan(txCalls.findIndex((c) => c.sql.startsWith("insert into public.endorsement (")));

    // passed → endorsed → final_interview_scheduled per application, in this UPDATE order (history_id ascending)
    expect(appMoves().map((m) => m.params)).toEqual([
      [A1, "passed", "endorsed", "Endorsed to the client"],
      [A1, "endorsed", "final_interview_scheduled", "Final interview scheduled"],
      [A2, "passed", "endorsed", "Endorsed to the client"],
      [A2, "endorsed", "final_interview_scheduled", "Final interview scheduled"],
    ]);
    expect(apps[A1].status).toBe("final_interview_scheduled");
    expect(apps[A2].status).toBe("final_interview_scheduled");
    expect(txSql("insert into public.talent_pool")).toEqual([]); // nobody goes to standby or the pool here
    // no applicant deadline: action_due_at is never written (only read with the ranking) and the setting is never read
    expect(dueWrites()).toHaveLength(0);
    expect(writes().filter((c) => c.sql.includes("action_due_at"))).toHaveLength(0);
    expect(txSql("from public.system_setting")).toHaveLength(0);

    // ONE notice per applicant (no "endorsed" or "final interview scheduled" notice), no staff notice
    const all = notices();
    expect(all.map((n) => [n.params[1], n.params[2]])).toEqual([
      [A1, "endorsement_notice"],
      [A2, "endorsement_notice"],
    ]);
    const [first] = all;
    expect(first.params[3]).toBe("Selected for endorsement: Cashier");
    expect(first.params[4]).toBe(`${notifyMessageDefault("Cashier")} ${SCHEDULE_LINE}`); // ends with the final interview
    expect(first.params[4].match(/\(Philippine time\)/g)).toHaveLength(1); // the final interview only
    expect(first.params[6]).toBe(false); // nothing to answer
    expect(`${first.params[3]} ${first.params[4]}`).not.toMatch(/kabayan|company|score|78\.41|%|hired|confirm|congratulations|!/i);

    // the vacancy → endorsing, after the moves; a closed job has no pending invitation to expire
    const move = txSql("update public.job_vacancy");
    expect(move).toHaveLength(1);
    expect(move[0].params.slice(0, 2)).toEqual([VACANCY_ID, "endorsing"]);
    expect(txCalls.indexOf(move[0])).toBeGreaterThan(txCalls.findLastIndex((c) => c.sql.startsWith("insert into public.notification")));
    expect(txSql("update public.pool_invitation pi")).toEqual([]);
  });

  it("decision 39-3: an OPEN vacancy that becomes endorsing expires its pending job invitations in the same transaction", async () => {
    const res = await notifyCall({ applicationIds: [A1] });
    expect(res.status).toBe(200);
    expect(res.body.data.vacancyStatus).toBe("endorsing");
    const moveAt = txCalls.findIndex((c) => c.sql.startsWith("update public.job_vacancy"));
    const expireAt = txCalls.findIndex((c) => c.sql.startsWith("update public.pool_invitation pi"));
    expect(txCalls[expireAt].params).toEqual([VACANCY_ID, "job_invitation", "expired", "pending"]);
    expect(expireAt).toBeGreaterThan(moveAt);
  });

  it("decision 39-3: an endorsing vacancy takes a second batch and stays endorsing (no invitation expiry)", async () => {
    vacancyLocked = { status: "endorsing" };
    vacancy.status = "endorsing";
    const res = await notifyCall({ applicationIds: [A1] });
    expect(res.status).toBe(200);
    expect(res.body.data.vacancyStatus).toBe("endorsing");
    expect(txSql("insert into public.endorsement (")).toHaveLength(1);
    expect(txSql("update public.pool_invitation pi")).toEqual([]);
  });

  it("decision 39-3: an accepted rematch offer (for_endorsement) is endorsed outside the place limit, with the same single notice", async () => {
    vacancy.committed = 2; // endorsement count 2: no place left, but A3 already holds one
    apps[A3].status = "for_endorsement";
    evaluated[2] = { ...evaluated[2], status: "for_endorsement", passed: true, finalScore: "76.00" };
    const res = await notifyCall({ applicationIds: [A3] });
    expect(res.status).toBe(200);
    expect(res.body.data.remaining).toBe(0);
    expect(appMoves().map((m) => m.params)).toEqual([
      [A3, "for_endorsement", "endorsed", "Endorsed to the client"],
      [A3, "endorsed", "final_interview_scheduled", "Final interview scheduled"],
    ]);
    expect(txSql("insert into public.endorsement_item")[0].params.slice(1, 4)).toEqual([A3, 3, 76]);
    expect(notices().map((n) => n.params[2])).toEqual(["endorsement_notice"]);

    // a passed applicant with it still needs a free place: none left → 422, nothing written
    txCalls = [];
    apps[A3].status = "for_endorsement";
    const refused = await notifyCall({ applicationIds: [A1, A3] });
    expect(refused.status).toBe(422);
    expect(refused.body.error.message).toBe("Only 0 more applicants can be notified (endorsement count 2).");
    expect(writes()).toEqual([]);
  });

  it("HR's edited body is used, followed by the final interview line and nothing else", async () => {
    const message = "You did well in the assessment for Cashier. Tell us if you want to go forward.";
    await notifyCall({ applicationIds: [A1], message });
    const [note] = notices();
    expect(note.params[4]).toBe(`${message} ${SCHEDULE_LINE}`);
  });

  it("a message naming the company (any case) → 422 with the field, nothing written", async () => {
    const res = await notifyCall({ applicationIds: [A1], message: "You will be endorsed to KABAYAN mart next week." });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Remove the company name: applicants never see the client company.");
    expect(res.body.error.details).toEqual([{ path: "message", message: "Remove the company name" }]);
    expect(writes()).toEqual([]);
  });

  it("decision 32: final interview details naming the company (any case) → 422 with the field, nothing written", async () => {
    const res = await notifyCall({ applicationIds: [A1], finalInterviewDetails: "Go to the Kabayan MART head office." });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Remove the company name: applicants never see the client company.");
    expect(res.body.error.details).toEqual([{ path: "finalInterviewDetails", message: "Remove the company name" }]);
    expect(writes()).toEqual([]);
  });

  it("decision 32: a final interview time in the past is accepted (no clock check)", async () => {
    const res = await notifyCall({ applicationIds: [A1], finalInterviewAt: "2026-01-05T10:00:00+08:00" });
    expect(res.status).toBe(200);
    expect(notices()[0].params[4].endsWith("Final interview: Jan 5, 2026, 10:00 AM (Philippine time). Bring two valid IDs.")).toBe(true);
  });

  it("more applicants than places left → 422, nothing written (endorsement 2, one already committed)", async () => {
    vacancy.committed = 1;
    const res = await notifyCall({ applicationIds: [A1, A2] });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Only 1 more applicant can be notified (endorsement count 2).");
    expect(writes()).toEqual([]);
  });

  it("a selected application that is not passed (or for_endorsement) → 409, nothing written", async () => {
    const res = await notifyCall({ applicationIds: [A1, A3] });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      "Only passed applicants (or accepted job offers waiting for the endorsement) can be notified. Refresh the ranking.",
    );
    expect(writes()).toEqual([]);
  });

  it("an application of another vacancy, or an unknown one → 404, nothing written", async () => {
    apps[A2].vacancyId = OTHER_VACANCY;
    expect((await notifyCall({ applicationIds: [A1, A2] })).status).toBe(404);
    expect((await notifyCall({ applicationIds: ["99999999-9999-4999-8999-999999999999"] })).status).toBe(404);
    expect(writes()).toEqual([]);
  });

  it.each([["draft"], ["filled"]])("a %s vacancy → 409, nothing written (decision 39-3: no batch)", async (status) => {
    vacancy.status = status;
    const res = await notifyCall({ applicationIds: [A1] });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(`This vacancy is ${status}; its applicants can no longer be notified.`);
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
    // decision 32: the final interview is required (a time with an offset, details 1–500 characters)
    expect((await rawNotify({ applicationIds: [A1] })).status).toBe(400);
    expect((await rawNotify({ applicationIds: [A1], finalInterviewAt: SCHEDULE.finalInterviewAt })).status).toBe(400);
    expect((await rawNotify({ applicationIds: [A1], finalInterviewDetails: "Bring IDs." })).status).toBe(400);
    expect((await notifyCall({ applicationIds: [A1], finalInterviewAt: "2026-10-16T09:30:00" })).status).toBe(400);
    expect((await notifyCall({ applicationIds: [A1], finalInterviewDetails: "   " })).status).toBe(400);
    expect((await notifyCall({ applicationIds: [A1], finalInterviewDetails: "x".repeat(501) })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("notifying the same applicant twice → the second gets 409 (now at the final interview); one batch only", async () => {
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(200);
    expect((await notifyCall({ applicationIds: [A1] })).status).toBe(409);
    expect(appMoves()).toHaveLength(2); // endorsed, final_interview_scheduled
    expect(txSql("insert into public.endorsement (")).toHaveLength(1);
  });

  it("decision 39-3: after Notify, the applicant's GET /api/applicant/interviews lists the final interview (kind final, time, details, no company)", async () => {
    apps[A1].userId = USER_ID; // the signed-in applicant is A1
    // The applicant read answers from what the Notify transaction wrote: its endorsement_item inserts, joined to the
    // application's current status (the repository's own filter: final_interview_scheduled, outcome pending).
    const base = pool.query.getMockImplementation();
    let finalSql;
    pool.query.mockImplementation(async (sql, params) => {
      if (sql.includes("from public.endorsement_item i") && sql.includes('as "scheduledAt"')) {
        finalSql = sql;
        const rows = txSql("insert into public.endorsement_item")
          .map(({ params: [, applicationId, , , at, details] }) => ({ applicationId, at, details }))
          .filter(({ applicationId }) => apps[applicationId]?.userId === params[0] && apps[applicationId].status === params[1])
          .map(({ applicationId, at, details }) => ({ applicationId, jobTitle: "Cashier", scheduledAt: at, details }));
        return { rows };
      }
      return base(sql, params);
    });

    expect((await notifyCall({ applicationIds: [A1, A2] })).status).toBe(200);
    role = "applicant";
    const res = await call("get", "/api/applicant/interviews");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { applicationId: A1, jobTitle: "Cashier", scheduledAt: "2026-10-16T01:30:00.000Z", details: "Bring two valid IDs.", kind: "final" },
    ]); // only A1's (A2 belongs to another applicant); no agency interview row
    const [row] = res.body.data;
    expect(Object.keys(row).sort()).toEqual(["applicationId", "details", "jobTitle", "kind", "scheduledAt"]);
    expect(JSON.stringify(res.body)).not.toMatch(/company|kabayan|score/i); // never the client company (rule 4)
    // the query itself reads only the job title, time and details, for this user at the final interview, outcome pending
    expect(finalSql).not.toMatch(/company/i);
    const [, finalParams] = pool.query.mock.calls.find(([s]) => s === finalSql);
    expect(finalParams).toEqual([USER_ID, "final_interview_scheduled", "pending"]);
  });

  it("decision 39-3: the old Create endorsement route is gone (404) and writes nothing", async () => {
    const res = await call("post", "/api/admin/endorsements").send({ vacancyId: VACANCY_ID, ...SCHEDULE });
    expect(res.status).toBe(404);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- applicant answer (removed, decision 37B)

describe("decision 37B: the applicant never confirms or declines the endorsement", () => {
  it("the old confirm / decline routes are gone (404) and write nothing, even for an old awaiting row", async () => {
    role = "applicant";
    apps[A1].status = "passed_awaiting_confirmation";
    for (const decision of ["confirm", "decline"]) {
      expect((await call("post", `/api/applicant/applications/${A1}/endorsement/${decision}`)).status).toBe(404);
    }
    expect(withTransaction).not.toHaveBeenCalled();
    expect(apps[A1].status).toBe("passed_awaiting_confirmation");
  });
});
