// Endorsement Management and client outcomes (S16; PRD FR-END-05..09, BR-17, BR-19, BR-22; TC-54..56, TC-82):
// Create endorsement (all for_endorsement → endorsed, remaining passed → standby as the system, vacancy → endorsing),
// outcomes (hired / not_hired, pool, notices, compare-and-set), the fill at hired = slots with the close-out in the same
// transaction and its lock order, training failed, the 23505 fallback, and roles.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const id = (n) => `a${n}a${n}a${n}a${n}-0000-4000-8000-00000000000${n}`;
const ITEM = (n) => `b${n}b${n}b${n}b${n}-0000-4000-8000-00000000000${n}`;
const ENDORSEMENT_ID = "e1e1e1e1-0000-4000-8000-000000000001";

let role;
let vacancy; // { status, slotsNeeded } returned by lockVacancy
let apps; // applicationId → { applicantId, status, userId, vacancyId, final, matching, appliedAt }
let items; // itemId → { applicationId, outcome }
let duplicate;
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const appMoves = () => txSql("update public.application set status = $3");
const notices = () => txSql("insert into public.notification");
const poolInserts = () => txSql("insert into public.talent_pool");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const lockIndex = (needle) => txCalls.findIndex((c) => c.sql.includes(needle) && /for update( of a)?$/.test(c.sql));

function addApp(n, status, extra = {}) {
  apps[id(n)] = {
    applicantId: `p${n}p${n}p${n}p${n}-0000-4000-8000-00000000000${n}`,
    status,
    userId: `u-${n}`,
    vacancyId: VACANCY_ID,
    final: 90 - n,
    matching: 80,
    appliedAt: `2026-10-08T0${n}:00:00Z`,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  vacancy = { status: "closed", slotsNeeded: 2 };
  apps = {};
  items = {};
  duplicate = null;
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

  const byStatus = (statuses) =>
    Object.entries(apps)
      .filter(([, a]) => a.vacancyId === VACANCY_ID && statuses.includes(a.status))
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([applicationId, a]) => ({ applicationId, applicantId: a.applicantId, status: a.status }));
  const evaluated = () =>
    Object.entries(apps).map(([applicationId, a]) => ({
      applicationId, status: a.status, appliedAt: a.appliedAt, applicantType: "experienced", actionDueAt: null,
      applicantName: `Applicant ${applicationId.slice(1, 2)}`, matchingScore: String(a.matching), interviewScore: "75.00",
      finalScore: a.final.toFixed(2), passingScore: "50.00", passed: true, overallRating: 4, reused: false,
    }));

  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes("from public.endorsement_item i") && sql.includes("where i.endorsement_item_id = $1::uuid")) {
      const item = items[params[0]];
      if (!item) return { rows: [] };
      const a = apps[item.applicationId];
      return { rows: [{ itemId: params[0], applicationId: item.applicationId, outcome: item.outcome, vacancyId: VACANCY_ID, applicantId: a.applicantId, status: a.status, userId: a.userId, jobTitle: "Cashier" }] };
    }
    if (sql.includes('a.applicant_id as "applicantId",') && sql.includes("where a.application_id = $1::uuid")) {
      const a = apps[params[0]];
      return { rows: a ? [{ applicationId: params[0], vacancyId: VACANCY_ID, applicantId: a.applicantId, status: a.status, userId: a.userId, jobTitle: "Cashier" }] : [] };
    }
    if (sql.includes('as "hiredCount"')) {
      return vacancy ? { rows: [{ vacancyId: VACANCY_ID, jobTitle: "Cashier", companyName: "Kabayan Mart", status: vacancy.status, slotsNeeded: vacancy.slotsNeeded, endorsementCount: 4, hiredCount: 0, passedCount: 1 }] } : { rows: [] };
    }
    if (sql.includes('as "reused"')) return { rows: evaluated() };
    if (sql.includes('i.endorsement_item_id as "itemId"') && sql.includes("e.sent_at desc")) return { rows: [] };
    if (sql.includes('as "contactEmail"')) return { rows: [] };
    if (sql.includes('as "forEndorsement"')) return { rows: [] };
    return { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    txCalls.push({ sql: flat, params });
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: vacancy ? [{ ...vacancy }] : [] };
    if (flat.startsWith('select application_id as "applicationId", applicant_id as "applicantId"') && flat.includes("job_vacancy_id = $1::uuid")) {
      return { rows: byStatus(params[1]) };
    }
    if (flat.startsWith("select applicant_id from public.applicant")) return { rows: [] };
    if (flat.endsWith("for update of a")) {
      return {
        rows: params[0]
          .filter((x) => apps[x])
          .sort()
          .map((x) => ({ applicationId: x, applicantId: apps[x].applicantId, vacancyId: apps[x].vacancyId, status: apps[x].status, userId: apps[x].userId })),
      };
    }
    if (sql.includes("from public.application where application_id = $1 for update")) {
      const a = apps[params[0]];
      return { rows: a ? [{ applicationId: params[0], applicantId: a.applicantId, vacancyId: a.vacancyId, applicantType: "experienced", status: a.status }] : [] };
    }
    if (sql.includes('as "reused"')) return { rows: evaluated() };
    if (sql.includes('as "hiredCount"')) return { rows: [{ jobTitle: "Cashier" }] };
    if (flat.startsWith("insert into public.endorsement_item")) {
      if (duplicate) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      return { rows: [], rowCount: 1 };
    }
    if (flat.startsWith("insert into public.endorsement ")) return { rows: [{ endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z" }] };
    if (sql.includes('as "hired"')) return { rows: [{ hired: Object.values(apps).filter((a) => a.status === "hired").length }] };
    if (flat.startsWith("select outcome from public.endorsement_item")) return { rows: items[params[0]] ? [{ outcome: items[params[0]].outcome }] : [] };
    if (flat.startsWith("update public.endorsement_item set outcome = $2")) {
      items[params[0]].outcome = params[1];
      return { rows: [], rowCount: 1 };
    }
    if (flat.startsWith("update public.job_vacancy set status = $2")) {
      vacancy.status = params[1];
      return { rows: [], rowCount: 1 };
    }
    if (flat.startsWith('select job_title as "jobTitle" from public.job_vacancy')) return { rows: [{ jobTitle: "Cashier" }] };
    if (flat.startsWith("update public.application set status = $3")) {
      const a = apps[params[0]];
      if (!a || a.status !== params[1]) return { rows: [], rowCount: 0 };
      a.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    return { rows: [], rowCount: 1 };
  });
});

// ---------------------------------------------------------------- create endorsement

describe("POST /api/admin/endorsements (FR-END-05/06; TC-54, TC-55)", () => {
  const create = () => call("post", "/api/admin/endorsements").send({ vacancyId: VACANCY_ID });

  beforeEach(() => {
    addApp(1, "for_endorsement");
    addApp(2, "for_endorsement");
    addApp(3, "passed");
    addApp(4, "passed_awaiting_confirmation");
  });

  it("endorses every for_endorsement application, moves the remaining passed to standby, and the vacancy to endorsing", async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      endorsementId: ENDORSEMENT_ID,
      sentAt: "2026-10-10T06:00:00Z",
      endorsed: [id(1), id(2)],
      standby: [id(3)],
      vacancyStatus: "endorsing",
    });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the actor

    // level by level: job_vacancy → every affected applicant (one statement) → every affected application
    const vacancyLock = lockIndex("application_cap");
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    const applicationLock = txCalls.findIndex((c) => c.sql.endsWith("for update of a"));
    expect(vacancyLock).toBe(0);
    expect(applicantLock).toBeGreaterThan(vacancyLock);
    expect(applicationLock).toBeGreaterThan(applicantLock);
    expect(txCalls[applicantLock].params).toEqual([[apps[id(1)].applicantId, apps[id(2)].applicantId, apps[id(3)].applicantId].sort()]);
    expect(txCalls[applicationLock].params).toEqual([[id(1), id(2), id(3)]]);

    // the batch and its items: RANK-03 ranks and the stored finals (89, 88 for a1, a2)
    const [batch] = txSql("insert into public.endorsement (");
    expect(batch.params).toEqual([VACANCY_ID, "sent", USER_ID]);
    expect(batch.sql).toContain("select v.job_vacancy_id, v.company_id, $2::public.endorsement_status, $3::uuid, now()");
    expect(txSql("insert into public.endorsement_item").map((c) => c.params)).toEqual([
      [ENDORSEMENT_ID, id(1), 1, 89],
      [ENDORSEMENT_ID, id(2), 2, 88],
    ]);

    expect(appMoves().map((m) => m.params)).toEqual([
      [id(1), "for_endorsement", "endorsed", "Endorsed to the client"],
      [id(2), "for_endorsement", "endorsed", "Endorsed to the client"],
      [id(3), "passed", "standby", "endorsement created: not included"],
    ]);
    // the standby move is the system's: actor cleared before it, restored after
    const clear = txCalls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    const standbyMove = txCalls.findIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "standby");
    const lastEndorsed = txCalls.findLastIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "endorsed");
    expect(clear).toBeGreaterThan(lastEndorsed);
    expect(standbyMove).toBeGreaterThan(clear);

    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(3)].applicantId, id(3), "standby"]]);
    expect(notices().map((n) => [n.params[1], n.params[2]])).toEqual([
      [id(1), "endorsed"],
      [id(2), "endorsed"],
      [id(3), "moved_to_standby"],
    ]);
    for (const n of notices()) expect(`${n.params[3]} ${n.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
    expect(txSql("update public.job_vacancy set status = $2")[0].params.slice(0, 2)).toEqual([VACANCY_ID, "endorsing"]);
    expect(apps[id(4)].status).toBe("passed_awaiting_confirmation"); // unanswered: stays (standby at fill)
  });

  it("nobody for_endorsement → 422, nothing written", async () => {
    apps[id(1)].status = "passed";
    apps[id(2)].status = "passed";
    const res = await create();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Nobody has confirmed the endorsement yet: notify passed applicants first.");
    expect(writes()).toEqual([]);
  });

  it.each([["draft"], ["filled"], ["archived"]])("a %s vacancy → 409, nothing written", async (status) => {
    vacancy.status = status;
    expect((await create()).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("an endorsing vacancy accepts a second batch and stays endorsing", async () => {
    vacancy.status = "endorsing";
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.data.vacancyStatus).toBe("endorsing");
  });

  it("23505 on endorsement_item_application_id_key → 409; any other error → 500", async () => {
    duplicate = "endorsement_item_application_id_key";
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This applicant is already endorsed. Refresh the page.");
    duplicate = "some_other_key";
    expect((await create()).status).toBe(500);
  });

  it("unknown vacancy → 404; applicants → 403; bad body → 400", async () => {
    vacancy = null;
    expect((await create()).status).toBe(404);
    role = "applicant";
    expect((await create()).status).toBe(403);
    role = "hr";
    expect((await call("post", "/api/admin/endorsements").send({ vacancyId: "nope" })).status).toBe(400);
  });
});

// ---------------------------------------------------------------- outcomes and fill

describe("PATCH /api/admin/endorsement-items/:id/outcome (FR-END-07/09; TC-56)", () => {
  const outcome = (n, body) => call("patch", `/api/admin/endorsement-items/${ITEM(n)}/outcome`).send(body);

  beforeEach(() => {
    vacancy = { status: "endorsing", slotsNeeded: 2 };
    addApp(1, "endorsed");
    addApp(2, "endorsed");
    addApp(3, "endorsed");
    addApp(5, "waiting_pool");
    addApp(6, "passed_awaiting_confirmation");
    for (const n of [1, 2, 3]) items[ITEM(n)] = { applicationId: id(n), outcome: "pending" };
  });

  it("not hired → not_hired (failed), pool not_hired, neutral notice; no fill", async () => {
    const res = await outcome(1, { outcome: "not_hired", remarks: "Client chose another candidate" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ itemId: ITEM(1), applicationId: id(1), outcome: "not_hired", status: "not_hired", vacancyStatus: "endorsing", closeOut: null });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "endorsed", "not_hired", "Client decision: not hired"]]);
    expect(txSql("update public.endorsement_item set outcome = $2")[0].params).toEqual([ITEM(1), "not_hired", USER_ID, null, "Client chose another candidate"]);
    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(1)].applicantId, id(1), "not_hired"]]);
    const [note] = notices();
    expect(note.params.slice(1, 4)).toEqual([id(1), "not_hired", "Employer decision: Cashier"]);
    expect(note.params[4]).toContain("You can apply to other jobs.");
    expect(txSql("update public.job_vacancy set status")).toEqual([]);
    // job_vacancy → applicant → application
    expect(lockIndex("application_cap")).toBe(0);
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    expect(txCalls[applicantLock].params).toEqual([[apps[id(1)].applicantId]]);
    expect(lockIndex("from public.application where application_id = $1")).toBeGreaterThan(applicantLock);
  });

  it("hired below the slots → hired, positive notice without the company, vacancy unchanged", async () => {
    const res = await outcome(1, { outcome: "hired", clientInterviewAt: "2026-10-12T10:00:00+08:00" });
    expect(res.body.data).toMatchObject({ status: "hired", vacancyStatus: "endorsing", closeOut: null });
    expect(txSql("update public.endorsement_item set outcome = $2")[0].params[3]).toBe("2026-10-12T02:00:00.000Z");
    const [note] = notices();
    expect(note.params.slice(2, 4)).toEqual(["hired", "Hired: Cashier"]);
    expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
    expect(poolInserts()).toEqual([]);
    expect(txSql("update public.job_vacancy set status")).toEqual([]);
  });

  it("the hire that reaches the slots fills the vacancy and closes it out in the same transaction (BR-22)", async () => {
    apps[id(2)].status = "hired"; // one already hired; slots 2
    items[ITEM(2)].outcome = "hired";
    const res = await outcome(1, { outcome: "hired" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      itemId: ITEM(1), applicationId: id(1), outcome: "hired", status: "hired", vacancyStatus: "filled",
      closeOut: { notSelected: 1, standby: 2 },
    });
    expect(txSql("update public.job_vacancy set status = $2")[0].params.slice(0, 2)).toEqual([VACANCY_ID, "filled"]);
    // close-out: a3 (endorsed, pending) and a6 (notified) → standby, a5 (waiting) → not_selected; a2 (hired) stays
    expect(apps[id(3)].status).toBe("standby");
    expect(apps[id(6)].status).toBe("standby");
    expect(apps[id(5)].status).toBe("not_selected");
    expect(apps[id(2)].status).toBe("hired");
    expect(txSql("update public.endorsement_item set outcome_remarks = $2").map((c) => c.params)).toEqual([[id(3), "vacancy filled", "pending"]]);
    const closeOutMoves = appMoves().filter((m) => m.params[3] === "close-out: vacancy filled").map((m) => m.params.slice(0, 3));
    expect(closeOutMoves).toEqual([
      [id(3), "endorsed", "standby"],
      [id(5), "waiting_pool", "not_selected"],
      [id(6), "passed_awaiting_confirmation", "standby"],
    ]);

    // lock order: the hired applicant AND every close-out applicant are locked in one statement, ascending, before
    // any application row (the close-out's own applicant lock then only re-takes locks already held)
    const firstApplicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    const firstApplicationLock = txCalls.findIndex((c) => /from public\.application (a )?.*for update( of a)?$/.test(c.sql) && !c.sql.includes("job_vacancy"));
    expect(firstApplicantLock).toBeGreaterThan(0);
    expect(firstApplicationLock).toBeGreaterThan(firstApplicantLock);
    expect(txCalls[firstApplicantLock].params).toEqual([
      [apps[id(1)].applicantId, apps[id(3)].applicantId, apps[id(5)].applicantId, apps[id(6)].applicantId].sort(),
    ]);
  });

  it("a second decision for the same applicant → 409, nothing written", async () => {
    expect((await outcome(1, { outcome: "hired" })).status).toBe(200);
    txCalls = [];
    const res = await outcome(1, { outcome: "not_hired" });
    expect(res.status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("an application that left endorsed (filled meanwhile → standby) → 409", async () => {
    apps[id(3)].status = "standby";
    expect((await outcome(3, { outcome: "hired" })).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("validation and roles: bad outcome → 400; unknown item → 404; applicant → 403", async () => {
    expect((await outcome(1, { outcome: "maybe" })).status).toBe(400);
    expect((await call("patch", `/api/admin/endorsement-items/${ITEM(9)}/outcome`).send({ outcome: "hired" })).status).toBe(404);
    role = "applicant";
    expect((await outcome(1, { outcome: "hired" })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- training failed

describe("POST /api/admin/applications/:id/training-failed (FR-END-08; TC-82)", () => {
  it("hired → training_failed (failed), pool training_failed, neutral notice; locks job_vacancy → applicant → application", async () => {
    addApp(1, "hired");
    const res = await call("post", `/api/admin/applications/${id(1)}/training-failed`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicationId: id(1), status: "training_failed" });
    expect(appMoves()[0].params).toEqual([id(1), "hired", "training_failed", "Training failed"]);
    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(1)].applicantId, id(1), "training_failed"]]);
    expect(notices()[0].params.slice(2, 4)).toEqual(["training_failed", "Training update: Cashier"]);
    expect(notices()[0].params[4]).toContain("You can apply to other jobs.");
    const vacancyLock = lockIndex("application_cap");
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    const applicationLock = lockIndex("from public.application where application_id = $1");
    expect([vacancyLock < applicantLock, applicantLock < applicationLock]).toEqual([true, true]);
  });

  it("not hired (e.g. endorsed) → 409, nothing written; unknown → 404", async () => {
    addApp(1, "endorsed");
    expect((await call("post", `/api/admin/applications/${id(1)}/training-failed`)).status).toBe(409);
    expect(writes()).toEqual([]);
    expect((await call("post", `/api/admin/applications/${id(9)}/training-failed`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------- read

describe("GET endorsement views", () => {
  it("vacancy view: for_endorsement candidates in RANK-03 order, the unanswered count, and the endorsements", async () => {
    addApp(1, "for_endorsement", { final: 70 });
    addApp(2, "for_endorsement", { final: 80 });
    addApp(3, "passed_awaiting_confirmation");
    const res = await call("get", `/api/admin/endorsements/${VACANCY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.candidates.map((c) => [c.applicationId, c.finalScore])).toEqual([
      [id(2), 80],
      [id(1), 70],
    ]);
    expect(res.body.data.awaitingConfirmation).toBe(1);
    expect(res.body.data.vacancy).toMatchObject({ companyName: "Kabayan Mart", slotsNeeded: 2 });
    expect(res.body.data.endorsements).toEqual([]);
  });

  it("an unknown printable endorsement → 404", async () => {
    expect((await call("get", `/api/admin/endorsements/print/${ENDORSEMENT_ID}`)).status).toBe(404);
  });
});
