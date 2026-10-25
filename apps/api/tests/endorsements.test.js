// Endorsement Management and client outcomes (S16; PRD FR-END-05..09, BR-17, BR-19, BR-22; TC-54..56, TC-82):
// decision 39-3: no Create endorsement (Notify creates each batch, rankingApi.test.js) and Remove at the final
// interview; outcomes (hired / not_hired, pool, notices, compare-and-set), the fill at hired = slots with the close-out
// in the same transaction and its lock order, training failed, the Outcomes view, and roles.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
// S17: the automatic rematch after not_hired has its own tests (rematchApi.test.js); here only the call is checked.
const REMATCH_RESULT = { status: "offered", offerId: "c1c1c1c1-0000-4000-8000-000000000001", jobTitle: "Store Crew", companyName: "ClayGo" };
vi.mock("../src/modules/rematch/rematch.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  runRematchAfterNotHired: vi.fn(async () => REMATCH_RESULT),
}));

const { pool } = await import("../src/db/pool.js");
const { runRematchAfterNotHired } = await import("../src/modules/rematch/rematch.service.js");
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
      return { rows: [{ itemId: params[0], applicationId: item.applicationId, outcome: item.outcome, vacancyId: VACANCY_ID, applicantId: a.applicantId, status: a.status, userId: a.userId, jobTitle: "Cashier", companyName: "Kabayan Mart" }] };
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

// ---------------------------------------------------------------- create endorsement (removed, decision 39-3)

describe("decision 39-3: no Create endorsement (Notify on the Ranking tab creates each batch; rankingApi.test.js)", () => {
  const create = () =>
    call("post", "/api/admin/endorsements").send({ vacancyId: VACANCY_ID, finalInterviewAt: "2026-10-16T09:30:00+08:00", finalInterviewDetails: "Bring two valid IDs." });

  beforeEach(() => {
    addApp(1, "for_endorsement");
    addApp(3, "passed");
  });

  it("POST /api/admin/endorsements → 404 for HR and admin (403 for applicants); nothing is written and nobody moves", async () => {
    for (const r of ["hr", "admin", "applicant"]) {
      role = r;
      expect((await create()).status).toBe(r === "applicant" ? 403 : 404);
    }
    expect(withTransaction).not.toHaveBeenCalled();
    expect(apps[id(1)].status).toBe("for_endorsement");
    expect(apps[id(3)].status).toBe("passed"); // decision 39-3: passed applicants not notified stay passed
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

  it("not hired before the final interview (endorsed) → not_hired (failed), pool not_hired, neutral notice; no fill", async () => {
    const res = await outcome(1, { outcome: "not_hired", remarks: "Client chose another candidate" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      itemId: ITEM(1), applicationId: id(1), outcome: "not_hired", status: "not_hired", vacancyStatus: "endorsing", closeOut: null,
      rematch: REMATCH_RESULT,
    });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);
    // S17 (BR-23): the rematch starts after the not_hired transaction, once, for this application
    expect(runRematchAfterNotHired.mock.calls).toEqual([[USER_ID, id(1)]]);
    expect(runRematchAfterNotHired.mock.invocationCallOrder[0]).toBeGreaterThan(withTransaction.mock.invocationCallOrder[0]);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "endorsed", "not_hired", "Client declined before the final interview"]]);
    const [itemWrite] = txSql("update public.endorsement_item set outcome = $2");
    expect(itemWrite.params).toEqual([ITEM(1), "not_hired", USER_ID, "Client chose another candidate"]);
    expect(itemWrite.sql).not.toContain("client_interview_at"); // the final interview time is never overwritten here
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

  it.each([
    ["final_interview_scheduled", "Did not proceed after the final interview"],
    ["for_hiring", "Client decision: not hired"],
    ["for_training", "Client decision: not hired during training"], // decision 37C: Not hired at every stage
    ["for_requirements", "Client decision: not hired at the requirements step"],
    ["for_orientation", "Client decision: not hired at orientation"],
  ])("not hired from %s → not_hired with its reason, pool, rematch after the commit", async (status, reason) => {
    apps[id(1)].status = status;
    const res = await outcome(1, { outcome: "not_hired" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "not_hired", rematch: REMATCH_RESULT });
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), status, "not_hired", reason]]);
    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(1)].applicantId, id(1), "not_hired"]]);
    expect(runRematchAfterNotHired.mock.calls).toEqual([[USER_ID, id(1)]]);
  });

  it("decision 37C: Deployed (hired) before For orientation → 409, nothing written", async () => {
    for (const status of ["endorsed", "final_interview_scheduled", "for_training", "for_requirements"]) {
      apps[id(1)].status = status;
      txCalls = [];
      const res = await outcome(1, { outcome: "hired" });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Move the applicant through training, requirements and orientation first.");
      expect(writes()).toEqual([]);
      expect(apps[id(1)].status).toBe(status);
    }
  });

  it("an old for_hiring row can still be deployed (hired)", async () => {
    apps[id(1)].status = "for_hiring";
    const res = await outcome(1, { outcome: "hired" });
    expect(res.status).toBe(200);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "for_hiring", "hired", "Client decision: hired"]]);
  });

  it("Deployed below the slots (from for_orientation) → hired, positive notice without the company, vacancy unchanged", async () => {
    apps[id(1)].status = "for_orientation";
    const res = await outcome(1, { outcome: "hired", clientInterviewAt: "2026-10-12T10:00:00+08:00" }); // old field: stripped
    expect(res.body.data).toMatchObject({ status: "hired", vacancyStatus: "endorsing", closeOut: null });
    expect(txSql("update public.endorsement_item set outcome = $2")[0].params).toEqual([ITEM(1), "hired", USER_ID, null]);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "for_orientation", "hired", "Client decision: hired"]]);
    const [note] = notices();
    expect(note.params.slice(2, 4)).toEqual(["hired", "Deployed: Cashier"]);
    expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
    expect(poolInserts()).toEqual([]);
    expect(txSql("update public.job_vacancy set status")).toEqual([]);
    expect(runRematchAfterNotHired.mock.calls).toEqual([]); // hired never starts a rematch
    expect(Object.keys(res.body.data).sort()).toEqual(["applicationId", "closeOut", "itemId", "outcome", "status", "vacancyStatus"]);
  });

  it("Phase 3: the hire that fills an OPEN vacancy also expires its pending job invitations, before the close-out", async () => {
    vacancy = { status: "open", slotsNeeded: 2 };
    apps[id(2)].status = "hired";
    items[ITEM(2)].outcome = "hired";
    apps[id(1)].status = "for_hiring";
    expect((await outcome(1, { outcome: "hired" })).body.data.vacancyStatus).toBe("filled");
    const fillAt = txCalls.findIndex((c) => c.sql.startsWith("update public.job_vacancy set status = $2"));
    const expireAt = txCalls.findIndex((c) => c.sql.startsWith("update public.pool_invitation pi"));
    expect(txCalls[expireAt].params).toEqual([VACANCY_ID, "job_invitation", "expired", "pending"]);
    expect(expireAt).toBeGreaterThan(fillAt);
  });

  it("the hire that reaches the slots fills the vacancy and closes it out in the same transaction (BR-22)", async () => {
    apps[id(2)].status = "hired"; // one already hired; slots 2
    items[ITEM(2)].outcome = "hired";
    apps[id(1)].status = "for_hiring";
    const res = await outcome(1, { outcome: "hired" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      itemId: ITEM(1), applicationId: id(1), outcome: "hired", status: "hired", vacancyStatus: "filled",
      closeOut: { notSelected: 1, standby: 2 },
    });
    expect(txSql("update public.job_vacancy set status = $2")[0].params.slice(0, 2)).toEqual([VACANCY_ID, "filled"]);
    expect(txSql("update public.pool_invitation pi")).toEqual([]); // filled from endorsing: no invitation could be pending
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
    apps[id(1)].status = "for_hiring";
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

// ---------------------------------------------------------------- final interview and For hiring (decisions 14/15)

describe("POST /api/admin/endorsement-items/:id/final-interview and /advance (decisions 14, 37C)", () => {
  const schedule = (n, body) => call("post", `/api/admin/endorsement-items/${ITEM(n)}/final-interview`).send(body);
  const advance = (n, to) => call("post", `/api/admin/endorsement-items/${ITEM(n)}/advance`).send({ to });
  const finalWrites = () => txSql("update public.endorsement_item set client_interview_at = $2");

  beforeEach(() => {
    vacancy = { status: "endorsing", slotsNeeded: 2 };
    addApp(1, "endorsed");
    items[ITEM(1)] = { applicationId: id(1), outcome: "pending" };
  });

  it("endorsed → final_interview_scheduled: time + details stored, applicant notified (job title, Philippine time, no company/score)", async () => {
    const res = await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00", details: "Bring two valid IDs." });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      itemId: ITEM(1), applicationId: id(1), status: "final_interview_scheduled", finalInterviewAt: "2026-10-20T01:30:00.000Z", rescheduled: false,
    });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);
    expect(finalWrites().map((c) => c.params)).toEqual([[ITEM(1), "2026-10-20T01:30:00.000Z", "Bring two valid IDs."]]);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "endorsed", "final_interview_scheduled", "Final interview scheduled"]]);
    const [note] = notices();
    expect(note.params.slice(1, 4)).toEqual([id(1), "final_interview_scheduled", "Final interview scheduled: Cashier"]);
    expect(note.params[4]).toBe(
      "Your final interview for Cashier is on Oct 20, 2026, 9:30 AM (Philippine time). Bring two valid IDs. " +
        "If you can't attend, please contact Confiable Manpower. The employer makes the final hiring decision.",
    );
    expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
    // job_vacancy → applicant → application, outcome re-read under the lock
    expect(lockIndex("application_cap")).toBe(0);
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    expect(lockIndex("from public.application where application_id = $1")).toBeGreaterThan(applicantLock);
  });

  it("no clock check: a time in the past is accepted, and the result can be recorded right away", async () => {
    expect((await schedule(1, { scheduledAt: "2026-01-01T08:00:00+08:00" })).status).toBe(200);
    expect((await advance(1, "for_training")).status).toBe(200);
    expect(apps[id(1)].status).toBe("for_training");
  });

  it("while scheduled, a new time changes it without a status move and sends 'time changed'", async () => {
    apps[id(1)].status = "final_interview_scheduled";
    const res = await schedule(1, { scheduledAt: "2026-10-21T14:00:00+08:00" });
    expect(res.body.data).toMatchObject({ status: "final_interview_scheduled", rescheduled: true });
    expect(appMoves()).toEqual([]);
    expect(finalWrites().map((c) => c.params)).toEqual([[ITEM(1), "2026-10-21T06:00:00.000Z", null]]);
    const [note] = notices();
    expect(note.params.slice(2, 4)).toEqual(["final_interview_rescheduled", "Final interview time changed: Cashier"]);
    expect(note.params[4]).toBe(
      "Your final interview for Cashier is now on Oct 21, 2026, 2:00 PM (Philippine time). If you can't attend, please contact Confiable Manpower.",
    );
  });

  it("details naming the company → 422 (same rule as Notify) before anything is locked or written (rule 4)", async () => {
    const res = await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00", details: "Go to the KABAYAN MART office." });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Remove the company name: applicants never see the client company.");
    expect(res.body.error.details).toEqual([{ path: "details", message: "Remove the company name" }]);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each([["for_endorsement"], ["for_hiring"], ["hired"], ["not_hired"], ["standby"]])("from %s → 409, nothing written", async (status) => {
    apps[id(1)].status = status;
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00" })).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("an item whose outcome is already recorded → 409", async () => {
    items[ITEM(1)].outcome = "not_hired";
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00" })).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("decision 37C: the fixed order, one stage at a time, each with its reason and notice; locks job_vacancy → applicant → application", async () => {
    apps[id(1)].status = "final_interview_scheduled";
    const steps = [
      ["for_training", "Proceeds after the final interview", "For training: Cashier"],
      ["for_requirements", "Training passed", "For requirements: Cashier"],
      ["for_orientation", "Requirements completed", "For orientation: Cashier"],
    ];
    let from = "final_interview_scheduled";
    for (const [to, reason, title] of steps) {
      txCalls = [];
      const res = await advance(1, to);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ itemId: ITEM(1), applicationId: id(1), status: to });
      expect(appMoves().map((m) => m.params)).toEqual([[id(1), from, to, reason]]);
      const [note, ...others] = notices();
      expect(others).toEqual([]);
      expect(note.params.slice(1, 4)).toEqual([id(1), to, title]);
      expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
      expect(lockIndex("application_cap")).toBe(0);
      const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
      expect(lockIndex("from public.application where application_id = $1")).toBeGreaterThan(applicantLock);
      from = to;
    }
    expect(withTransaction.mock.calls.every(([actor]) => actor === USER_ID)).toBe(true); // HR is the actor
  });

  it("decision 37C: skipping a stage, going back, or advancing from the wrong status → 409, nothing written", async () => {
    for (const [status, to] of [
      ["endorsed", "for_training"], // the final interview first
      ["final_interview_scheduled", "for_requirements"], // no skipping
      ["final_interview_scheduled", "for_orientation"],
      ["for_training", "for_orientation"],
      ["for_orientation", "for_training"], // no going back
      ["for_hiring", "for_training"], // an old row
      ["hired", "for_orientation"],
    ]) {
      apps[id(1)].status = status;
      txCalls = [];
      const res = await advance(1, to);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("This applicant is not at the step before that stage. Refresh the page.");
      expect(writes()).toEqual([]);
    }
    // an item whose decision is already recorded → 409 too
    apps[id(1)].status = "final_interview_scheduled";
    items[ITEM(1)].outcome = "not_hired";
    expect((await advance(1, "for_training")).status).toBe(409);
  });

  it("validation and roles: missing or offset-less time / unknown stage → 400; unknown item → 404; applicant → 403; /for-hiring is gone", async () => {
    expect((await schedule(1, {})).status).toBe(400);
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00" })).status).toBe(400);
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00", details: "x".repeat(501) })).status).toBe(400);
    for (const to of ["hired", "for_hiring", "final_interview_scheduled", "training"]) expect((await advance(1, to)).status).toBe(400);
    expect((await call("post", `/api/admin/endorsement-items/${ITEM(9)}/advance`).send({ to: "for_training" })).status).toBe(404);
    expect((await call("post", `/api/admin/endorsement-items/${ITEM(1)}/for-hiring`)).status).toBe(404); // route removed
    role = "applicant";
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00" })).status).toBe(403);
    expect((await advance(1, "for_training")).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- training failed

describe("POST /api/admin/endorsement-items/:id/training-failed (FR-END-08; TC-82; decision 37C)", () => {
  const trainingFailed = (n) => call("post", `/api/admin/endorsement-items/${ITEM(n)}/training-failed`);
  beforeEach(() => {
    vacancy = { status: "endorsing", slotsNeeded: 2 };
  });

  it("for_training → training_failed (failed), item not_hired 'Training failed', pool training_failed, neutral notice, no rematch", async () => {
    addApp(1, "for_training");
    items[ITEM(1)] = { applicationId: id(1), outcome: "pending" };
    const res = await trainingFailed(1);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ itemId: ITEM(1), applicationId: id(1), status: "training_failed" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the actor
    expect(txSql("update public.endorsement_item set outcome = $2")[0].params).toEqual([ITEM(1), "not_hired", USER_ID, "Training failed"]);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "for_training", "training_failed", "Training failed"]]);
    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(1)].applicantId, id(1), "training_failed"]]);
    const [note, ...others] = notices();
    expect(others).toEqual([]);
    expect(note.params.slice(2, 4)).toEqual(["training_failed", "Training update: Cashier"]);
    expect(note.params[4]).toContain("You can apply to other jobs.");
    expect(runRematchAfterNotHired).not.toHaveBeenCalled();
    const vacancyLock = lockIndex("application_cap");
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    const applicationLock = lockIndex("from public.application where application_id = $1");
    expect([vacancyLock < applicantLock, applicantLock < applicationLock]).toEqual([true, true]);
  });

  it("only at For training: any other stage (hired included) → 409, nothing written; unknown item → 404; the old route is gone", async () => {
    for (const status of ["endorsed", "final_interview_scheduled", "for_requirements", "for_orientation", "for_hiring", "hired"]) {
      addApp(1, status);
      items[ITEM(1)] = { applicationId: id(1), outcome: status === "hired" ? "hired" : "pending" };
      txCalls = [];
      const res = await trainingFailed(1);
      expect(res.status).toBe(409);
      expect(writes()).toEqual([]);
    }
    expect((await trainingFailed(9)).status).toBe(404);
    expect((await call("post", `/api/admin/applications/${id(1)}/training-failed`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------- Outcomes view (decision 37C)

describe("decision 37C / 39-3: not hired, training failed and removed leave the Outcomes view (history kept)", () => {
  it("the items of returned or removed applicants are left out; the batch stays listed (printable page) even when empty", async () => {
    addApp(1, "for_training");
    const rows = [
      { endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z", itemId: ITEM(1), applicationId: id(1), status: "for_training", finalScore: "80.00" },
      { endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z", itemId: ITEM(2), applicationId: id(2), status: "not_hired", finalScore: "79.00" },
      { endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z", itemId: ITEM(3), applicationId: id(3), status: "training_failed", finalScore: "78.00" },
      { endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z", itemId: ITEM(5), applicationId: id(5), status: "archived", finalScore: "77.00" }, // removed (39-3)
      { endorsementId: "e2e2e2e2-0000-4000-8000-000000000002", sentAt: "2026-10-09T06:00:00Z", itemId: ITEM(4), applicationId: id(4), status: "not_hired", finalScore: "70.00" },
    ];
    const base = pool.query.getMockImplementation();
    pool.query.mockImplementation(async (sql, params) =>
      sql.includes('i.endorsement_item_id as "itemId"') && sql.includes("e.sent_at desc") ? { rows } : base(sql, params),
    );
    const res = await call("get", `/api/admin/endorsements/${VACANCY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.endorsements).toEqual([
      { endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z", items: [{ itemId: ITEM(1), applicationId: id(1), status: "for_training", finalScore: 80 }] },
      { endorsementId: "e2e2e2e2-0000-4000-8000-000000000002", sentAt: "2026-10-09T06:00:00Z", items: [] },
    ]);
  });
});

// ---------------------------------------------------------------- remove at the final interview (decision 39-3)

describe("POST /api/admin/endorsement-items/:id/remove (decision 39-3: Remove at the final interview)", () => {
  const remove = (n, body = { reason: "Applicant called: accepted another job." }) =>
    call("post", `/api/admin/endorsement-items/${ITEM(n)}/remove`).send(body);
  const remarkWrites = () => txSql("update public.endorsement_item set outcome_remarks = $2");

  beforeEach(() => {
    vacancy = { status: "endorsing", slotsNeeded: 2 };
  });

  it("final_interview_scheduled → archived as HR with the reason; item stays pending with remarks; neutral notice; no pool entry", async () => {
    addApp(1, "final_interview_scheduled");
    items[ITEM(1)] = { applicationId: id(1), outcome: "pending" };
    const res = await remove(1);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ itemId: ITEM(1), applicationId: id(1), status: "archived" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    // DATABASE_SCHEMA §8: job_vacancy → applicant → application, the outcome re-read under the lock
    expect(lockIndex("application_cap")).toBe(0);
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select applicant_id from public.applicant"));
    expect(applicantLock).toBeGreaterThan(0);
    expect(lockIndex("from public.application where application_id = $1 for update")).toBeGreaterThan(applicantLock);
    // the item keeps outcome pending (no enum change) with HR's marker; the reason only in the status history
    expect(remarkWrites().map((c) => c.params)).toEqual([[ITEM(1), "Removed from endorsement"]]);
    expect(txSql("update public.endorsement_item set outcome = $2")).toEqual([]);
    expect(items[ITEM(1)].outcome).toBe("pending");
    expect(appMoves().map((m) => m.params)).toEqual([
      [id(1), "final_interview_scheduled", "archived", "Removed from endorsement: Applicant called: accepted another job."],
    ]);
    expect(poolInserts()).toEqual([]); // neutral: no applicant pool, no company block (archived is neutral)
    expect(runRematchAfterNotHired).not.toHaveBeenCalled();
    const [note, ...others] = notices();
    expect(others).toEqual([]);
    expect(note.params.slice(0, 4)).toEqual(["u-1", id(1), "endorsement_removed", "Application closed: Cashier"]);
    expect(note.params[4]).toBe("Your application for Cashier is closed. You can apply to other jobs.");
    expect(note.params[4]).not.toMatch(/another job|reason|kabayan|company|employer/i); // never HR's reason or the company
    expect(res.body.data).not.toHaveProperty("reason");
  });

  it("only at the final interview: any other stage, or an item already decided → 409, nothing written", async () => {
    for (const status of ["endorsed", "for_endorsement", "for_training", "for_requirements", "for_orientation", "for_hiring", "hired", "not_hired", "archived"]) {
      addApp(1, status);
      items[ITEM(1)] = { applicationId: id(1), outcome: status === "hired" ? "hired" : "pending" };
      txCalls = [];
      const res = await remove(1);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Only an applicant at the final interview can be removed. Refresh the page.");
      expect(writes()).toEqual([]);
    }
    addApp(1, "final_interview_scheduled");
    items[ITEM(1)] = { applicationId: id(1), outcome: "not_hired" };
    txCalls = [];
    expect((await remove(1)).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("a reason under 5 characters, missing, or over 500 → 400; an unknown item → 404; applicants 403; the old route is gone", async () => {
    addApp(1, "final_interview_scheduled");
    items[ITEM(1)] = { applicationId: id(1), outcome: "pending" };
    expect((await remove(1, { reason: " no " })).status).toBe(400);
    expect((await remove(1, {})).status).toBe(400);
    expect((await remove(1, { reason: "x".repeat(501) })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    expect((await remove(9)).status).toBe(404);
    // decision 39-3: the application-based route of decision 37B is removed
    const old = await call("post", `/api/admin/applications/${id(1)}/remove-from-endorsement`).send({ reason: "Applicant called." });
    expect(old.status).toBe(404);
    role = "applicant";
    expect((await remove(1)).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(apps[id(1)].status).toBe("final_interview_scheduled");
  });
});

describe("GET endorsement views", () => {
  it("vacancy view: the vacancy and its endorsements only (decision 39-3: no candidates; the ranking is not read)", async () => {
    addApp(1, "for_endorsement", { final: 70 });
    const res = await call("get", `/api/admin/endorsements/${VACANCY_ID}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(["endorsements", "vacancy"]);
    expect(res.body.data.vacancy).toMatchObject({ companyName: "Kabayan Mart", slotsNeeded: 2 });
    expect(res.body.data.endorsements).toEqual([]);
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('as "reused"'))).toBe(false);
  });

  it("list: vacancies with someone with the client or deployed (or endorsing / filled); no to-endorse count (decision 39-3)", async () => {
    const res = await call("get", "/api/admin/endorsements");
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes('as "endorsed"') && s.includes("group by v.job_vacancy_id"));
    expect(sql).not.toContain('"forEndorsement"');
    expect(params).toEqual([
      ["endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation"],
      "hired",
      ["endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation", "hired"],
      ["endorsing", "filled"],
    ]);
  });

  it("an unknown printable endorsement → 404", async () => {
    expect((await call("get", `/api/admin/endorsements/print/${ENDORSEMENT_ID}`)).status).toBe(404);
  });
});
