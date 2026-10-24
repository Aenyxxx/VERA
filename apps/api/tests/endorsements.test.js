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
const { messageFor } = await import("../src/domain/notify.js");

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
let toldMessages; // applicationId → the latest "Please confirm" message (decision 32)

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const appMoves = () => txSql("update public.application set status = $3");
const notices = () => txSql("insert into public.notification");
const poolInserts = () => txSql("insert into public.talent_pool");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const lockIndex = (needle) => txCalls.findIndex((c) => c.sql.includes(needle) && /for update( of a)?$/.test(c.sql));

/** Decision 32: the "Please confirm" message application n got at Notify. */
function tellApp(n, message) {
  toldMessages[id(n)] = message;
}

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
  toldMessages = {};

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
    if (flat.startsWith("insert into public.endorsement_item")) {
      if (duplicate) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      return { rows: [], rowCount: 1 };
    }
    if (flat.startsWith("insert into public.endorsement ")) return { rows: [{ endorsementId: ENDORSEMENT_ID, sentAt: "2026-10-10T06:00:00Z" }] };
    if (sql.includes('as "hired"')) return { rows: [{ hired: Object.values(apps).filter((a) => a.status === "hired").length }] };
    if (flat.startsWith('select distinct on (n.application_id) n.application_id as "applicationId", n.message')) {
      return { rows: params[0].filter((x) => toldMessages[x]).map((x) => ({ applicationId: x, message: toldMessages[x] })) };
    }
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

describe("POST /api/admin/endorsements (FR-END-05/06; TC-54, TC-55; decision 32)", () => {
  // Decision 32: one final interview for the batch, the same one A1 and A2 confirmed in their Notify message.
  const AT = "2026-10-16T01:30:00.000Z";
  const DETAILS = "Bring two valid IDs.\nAsk for the store manager.";
  const told = (at, details) =>
    messageFor("passed_confirm_endorsement", {
      jobTitle: "Cashier",
      message: "We would like to endorse you.",
      finalInterviewAt: at,
      finalInterviewDetails: details,
      actionDueAt: "2026-10-13T06:00:00.000Z",
    }).message;
  const send = (body) => call("post", "/api/admin/endorsements").send(body);
  const create = (extra = {}) =>
    send({ vacancyId: VACANCY_ID, finalInterviewAt: "2026-10-16T09:30:00+08:00", finalInterviewDetails: `  ${DETAILS}  `, ...extra });

  beforeEach(() => {
    addApp(1, "for_endorsement");
    addApp(2, "for_endorsement");
    addApp(3, "passed");
    addApp(4, "passed_awaiting_confirmation");
    tellApp(1, told(AT, DETAILS));
    tellApp(2, told(AT, "Bring two valid IDs. Ask  for the store manager.")); // same text after normalization
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
      finalInterviewAt: AT,
      timeChanged: [],
      firstNotice: [],
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
    // decision 32: every item carries the batch's final interview; the details are stored as typed (trimmed)
    expect(txSql("insert into public.endorsement_item").map((c) => c.params)).toEqual([
      [ENDORSEMENT_ID, id(1), 1, 89, AT, DETAILS],
      [ENDORSEMENT_ID, id(2), 2, 88, AT, DETAILS],
    ]);
    // what each applicant was told is read under the application locks, before anything is written
    const toldRead = txCalls.findIndex((c) => c.sql.startsWith("select distinct on (n.application_id)"));
    // decision 37B: the new information notice, or an old "Please confirm" message
    expect(txCalls[toldRead].params).toEqual([[id(1), id(2)], ["endorsement_notice", "passed_confirm_endorsement"]]);
    expect(txCalls[toldRead].sql).toContain("n.notification_type = any($2::text[])");
    expect(toldRead).toBeGreaterThan(applicationLock);
    expect(toldRead).toBeLessThan(txCalls.findIndex((c) => c.sql.startsWith("insert into public.endorsement (")));

    // decision 32: endorsed, then final_interview_scheduled, per application; the history trigger writes its rows in
    // this UPDATE order (history_id ascending), so endorsed always comes before final_interview_scheduled
    expect(appMoves().map((m) => m.params)).toEqual([
      [id(1), "for_endorsement", "endorsed", "Endorsed to the client"],
      [id(1), "endorsed", "final_interview_scheduled", "Final interview scheduled"],
      [id(2), "for_endorsement", "endorsed", "Endorsed to the client"],
      [id(2), "endorsed", "final_interview_scheduled", "Final interview scheduled"],
      [id(3), "passed", "standby", "endorsement created: not included"],
    ]);
    expect(apps[id(1)].status).toBe("final_interview_scheduled");
    expect(apps[id(2)].status).toBe("final_interview_scheduled");
    // the standby move is the system's: actor cleared before it, restored after
    const clear = txCalls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    const standbyMove = txCalls.findIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "standby");
    const lastEndorsed = txCalls.findLastIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "final_interview_scheduled");
    expect(clear).toBeGreaterThan(lastEndorsed);
    expect(standbyMove).toBeGreaterThan(clear);

    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(3)].applicantId, id(3), "standby"]]);
    // decision 32: both were told exactly this final interview → no second schedule notice
    expect(notices().map((n) => [n.params[1], n.params[2]])).toEqual([
      [id(1), "endorsed"],
      [id(2), "endorsed"],
      [id(3), "moved_to_standby"],
    ]);
    for (const n of notices()) expect(`${n.params[3]} ${n.params[4]}`).not.toMatch(/kabayan|company|score|%/i);
    expect(txSql("update public.job_vacancy set status = $2")[0].params.slice(0, 2)).toEqual([VACANCY_ID, "endorsing"]);
    expect(apps[id(4)].status).toBe("passed_awaiting_confirmation"); // unanswered: stays (standby at fill)
    expect(txSql("update public.pool_invitation pi")).toEqual([]); // the vacancy was closed: nothing left to expire
  });

  it("Phase 3: an OPEN vacancy that becomes endorsing expires its pending job invitations in the same transaction", async () => {
    vacancy.status = "open";
    expect((await create()).status).toBe(201);
    const moveAt = txCalls.findIndex((c) => c.sql.startsWith("update public.job_vacancy set status = $2"));
    const expireAt = txCalls.findIndex((c) => c.sql.startsWith("update public.pool_invitation pi"));
    expect(txCalls[expireAt].params).toEqual([VACANCY_ID, "job_invitation", "expired", "pending"]);
    expect(expireAt).toBeGreaterThan(moveAt);
  });

  it("decision 32: a schedule that differs from someone's Notify message → 409 FINAL_INTERVIEW_CHANGED, nothing written", async () => {
    tellApp(2, told("2026-10-16T02:30:00.000Z", DETAILS)); // A2 was told 10:30, HR now enters 9:30
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: "FINAL_INTERVIEW_CHANGED",
      message: "This final interview differs from what some applicants were told. Confirm to send them 'Final interview time changed'.",
      details: [{ applicationId: id(2) }],
    });
    expect(writes()).toEqual([]);
    expect(apps[id(1)].status).toBe("for_endorsement");
    expect(apps[id(2)].status).toBe("for_endorsement");
  });

  it("decision 32: HR acknowledged → the same transaction sends 'Final interview time changed' to that applicant only", async () => {
    tellApp(2, told(AT, "Bring one valid ID.")); // other details are a change too
    const res = await create({ acknowledgeChange: true });
    expect(res.status).toBe(201);
    expect(res.body.data.timeChanged).toEqual([id(2)]);
    expect(res.body.data.firstNotice).toEqual([]);
    expect(notices().map((n) => [n.params[1], n.params[2]])).toEqual([
      [id(1), "endorsed"],
      [id(2), "endorsed"],
      [id(2), "final_interview_rescheduled"],
      [id(3), "moved_to_standby"],
    ]);
    const changed = notices()[2];
    expect(changed.params[3]).toBe("Final interview time changed: Cashier");
    expect(changed.params[4]).toContain("Oct 16, 2026, 9:30 AM (Philippine time)");
    expect(changed.params[4]).toContain("Ask for the store manager.");
    expect(`${changed.params[3]} ${changed.params[4]}`).not.toMatch(/kabayan|score/i);
    expect(apps[id(2)].status).toBe("final_interview_scheduled");
  });

  it("decision 32: an applicant with no Notify message (accepted rematch offer) gets 'Final interview scheduled'", async () => {
    delete toldMessages[id(1)];
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.data.firstNotice).toEqual([id(1)]);
    expect(res.body.data.timeChanged).toEqual([]);
    expect(notices().map((n) => [n.params[1], n.params[2]])).toEqual([
      [id(1), "endorsed"],
      [id(1), "final_interview_scheduled"],
      [id(2), "endorsed"],
      [id(3), "moved_to_standby"],
    ]);
    expect(notices()[1].params[3]).toBe("Final interview scheduled: Cashier");
  });

  it("decision 32: details naming the company → 422 before any transaction (rule 4)", async () => {
    const res = await create({ finalInterviewDetails: "Report to the KABAYAN MART office." });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ path: "finalInterviewDetails", message: "Remove the company name" }]);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(txCalls).toEqual([]);
  });

  it("decision 32: the final interview is required (time with an offset, details 1–500 characters) → 400", async () => {
    expect((await send({ vacancyId: VACANCY_ID })).status).toBe(400);
    expect((await create({ finalInterviewAt: undefined })).status).toBe(400);
    expect((await create({ finalInterviewAt: "2026-10-16T09:30:00" })).status).toBe(400);
    expect((await create({ finalInterviewDetails: "  " })).status).toBe(400);
    expect((await create({ finalInterviewDetails: "x".repeat(501) })).status).toBe(400);
    expect((await create({ acknowledgeChange: "yes" })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("nobody for_endorsement → 422, nothing written", async () => {
    apps[id(1)].status = "passed";
    apps[id(2)].status = "passed";
    const res = await create();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Nobody to endorse yet: notify passed applicants first.");
    expect(writes()).toEqual([]);
  });

  it("decision 37B: a 'Selected for endorsement' notice with the same schedule → no second notice; another schedule → 409 first", async () => {
    const notice = (at, details) =>
      messageFor("endorsement_notice", {
        jobTitle: "Cashier",
        message: "We would like to endorse you.",
        finalInterviewAt: at,
        finalInterviewDetails: details,
      }).message;
    tellApp(1, notice(AT, DETAILS));
    tellApp(2, notice(AT, "Bring two valid IDs. Ask  for the store manager.")); // same after normalization
    const same = await create();
    expect(same.status).toBe(201);
    expect(same.body.data.timeChanged).toEqual([]);
    expect(notices().map((n) => n.params[2]).filter((t) => t.startsWith("final_interview"))).toEqual([]);

    // a fresh batch whose notice announced another time: the warning first, nothing written
    txCalls = [];
    addApp(5, "for_endorsement");
    tellApp(5, notice("2026-10-17T01:30:00.000Z", DETAILS));
    const changed = await create();
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("FINAL_INTERVIEW_CHANGED");
    expect(changed.body.error.details).toEqual([{ applicationId: id(5) }]);
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
    expect((await create({ vacancyId: "nope" })).status).toBe(400);
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
  ])("not hired from %s → not_hired with its reason, pool, rematch after the commit", async (status, reason) => {
    apps[id(1)].status = status;
    const res = await outcome(1, { outcome: "not_hired" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "not_hired", rematch: REMATCH_RESULT });
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), status, "not_hired", reason]]);
    expect(poolInserts().map((c) => c.params)).toEqual([[apps[id(1)].applicantId, id(1), "not_hired"]]);
    expect(runRematchAfterNotHired.mock.calls).toEqual([[USER_ID, id(1)]]);
  });

  it("decision 15: hired straight from endorsed or from the final interview → 409, nothing written", async () => {
    for (const status of ["endorsed", "final_interview_scheduled"]) {
      apps[id(1)].status = status;
      txCalls = [];
      const res = await outcome(1, { outcome: "hired" });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Schedule the final interview and mark it as proceeding first.");
      expect(writes()).toEqual([]);
      expect(apps[id(1)].status).toBe(status);
    }
  });

  it("hired below the slots (from for_hiring) → hired, positive notice without the company, vacancy unchanged", async () => {
    apps[id(1)].status = "for_hiring";
    const res = await outcome(1, { outcome: "hired", clientInterviewAt: "2026-10-12T10:00:00+08:00" }); // old field: stripped
    expect(res.body.data).toMatchObject({ status: "hired", vacancyStatus: "endorsing", closeOut: null });
    expect(txSql("update public.endorsement_item set outcome = $2")[0].params).toEqual([ITEM(1), "hired", USER_ID, null]);
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "for_hiring", "hired", "Client decision: hired"]]);
    const [note] = notices();
    expect(note.params.slice(2, 4)).toEqual(["hired", "Hired: Cashier"]);
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

describe("POST /api/admin/endorsement-items/:id/final-interview and /for-hiring (decisions 14/15)", () => {
  const schedule = (n, body) => call("post", `/api/admin/endorsement-items/${ITEM(n)}/final-interview`).send(body);
  const forHiring = (n) => call("post", `/api/admin/endorsement-items/${ITEM(n)}/for-hiring`);
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
    expect((await forHiring(1)).status).toBe(200);
    expect(apps[id(1)].status).toBe("for_hiring");
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

  it("For hiring: final_interview_scheduled → for_hiring + notice; from endorsed → 409", async () => {
    expect((await forHiring(1)).status).toBe(409);
    expect(writes()).toEqual([]);
    apps[id(1)].status = "final_interview_scheduled";
    const res = await forHiring(1);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ itemId: ITEM(1), applicationId: id(1), status: "for_hiring" });
    expect(appMoves().map((m) => m.params)).toEqual([[id(1), "final_interview_scheduled", "for_hiring", "Proceeds after the final interview"]]);
    const [note] = notices();
    expect(note.params.slice(2, 4)).toEqual(["for_hiring", "For hiring: Cashier"]);
    expect(note.params[4]).toBe(
      "You passed the employer's final interview for Cashier. The employer makes the final hiring decision. We will tell you the result.",
    );
  });

  it("validation and roles: missing or offset-less time → 400; unknown item → 404; applicant → 403", async () => {
    expect((await schedule(1, {})).status).toBe(400);
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00" })).status).toBe(400);
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00", details: "x".repeat(501) })).status).toBe(400);
    expect((await call("post", `/api/admin/endorsement-items/${ITEM(9)}/for-hiring`)).status).toBe(404);
    role = "applicant";
    expect((await schedule(1, { scheduledAt: "2026-10-20T09:30:00+08:00" })).status).toBe(403);
    expect((await forHiring(1)).status).toBe(403);
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

// ---------------------------------------------------------------- remove from endorsement (decision 37B)

describe("POST /api/admin/applications/:id/remove-from-endorsement (decision 37B)", () => {
  const remove = (n, body = { reason: "Applicant called: accepted another job." }) =>
    call("post", `/api/admin/applications/${id(n)}/remove-from-endorsement`).send(body);

  it("for_endorsement → archived as HR with the reason; neutral notice; no pool entry; the place counts again", async () => {
    addApp(1, "for_endorsement");
    const res = await remove(1);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicationId: id(1), status: "archived" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    // DATABASE_SCHEMA §8: job_vacancy → application, no applicant row (no pool entry)
    expect(lockIndex("application_cap")).toBe(0);
    expect(lockIndex("from public.application where application_id = $1 for update")).toBeGreaterThan(0);
    expect(txSql("from public.applicant")).toEqual([]);
    expect(appMoves().map((m) => m.params)).toEqual([
      [id(1), "for_endorsement", "archived", "Removed from endorsement: Applicant called: accepted another job."],
    ]);
    expect(poolInserts()).toEqual([]); // neutral: no applicant pool, no company block (archived is neutral)
    const [note, ...others] = notices();
    expect(others).toEqual([]);
    expect(note.params.slice(0, 4)).toEqual(["u-1", id(1), "endorsement_removed", "Application closed: Cashier"]);
    expect(note.params[4]).toBe("Your application for Cashier will not go forward to the employer. You can apply to other jobs.");
    expect(note.params[4]).not.toMatch(/another job|reason|kabayan|company/i); // never HR's reason or the company
    expect(res.body.data).not.toHaveProperty("reason");
  });

  it("any other status → 409, nothing written (passed, endorsed, an old awaiting row)", async () => {
    for (const [n, status] of [[1, "passed"], [2, "final_interview_scheduled"], [3, "passed_awaiting_confirmation"]]) {
      addApp(n, status);
      const res = await remove(n);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Only an applicant waiting for the endorsement can be removed. Refresh the page.");
    }
    expect(writes()).toEqual([]);
  });

  it("a reason under 5 characters, missing, or over 500 → 400; an unknown application → 404; applicants 403", async () => {
    addApp(1, "for_endorsement");
    expect((await remove(1, { reason: " no " })).status).toBe(400);
    expect((await remove(1, {})).status).toBe(400);
    expect((await remove(1, { reason: "x".repeat(501) })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    expect((await remove(9)).status).toBe(404);
    role = "applicant";
    expect((await remove(1)).status).toBe(403);
    expect(apps[id(1)].status).toBe("for_endorsement");
  });
});

describe("GET endorsement views", () => {
  it("vacancy view: for_endorsement candidates in RANK-03 order and the endorsements (decision 37B: no unanswered count)", async () => {
    addApp(1, "for_endorsement", { final: 70 });
    addApp(2, "for_endorsement", { final: 80 });
    addApp(3, "passed_awaiting_confirmation"); // an old row: not a candidate, not counted
    const res = await call("get", `/api/admin/endorsements/${VACANCY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.candidates.map((c) => [c.applicationId, c.finalScore])).toEqual([
      [id(2), 80],
      [id(1), 70],
    ]);
    expect(Object.keys(res.body.data).sort()).toEqual(["candidates", "endorsements", "vacancy"]);
    expect(res.body.data.vacancy).toMatchObject({ companyName: "Kabayan Mart", slotsNeeded: 2 });
    expect(res.body.data.endorsements).toEqual([]);
  });

  it("an unknown printable endorsement → 404", async () => {
    expect((await call("get", `/api/admin/endorsements/print/${ENDORSEMENT_ID}`)).status).toBe(404);
  });
});
