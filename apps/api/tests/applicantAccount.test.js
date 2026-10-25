// Applicant account status from Applicant Management (decision 39-4; moved from the Applicant Pool, decision 37D): any
// applicant, HR and admin, reason required to deactivate (stored on user_account), the ongoing application closed
// neutrally (archived, no pool entry, no company block, no notice) with its interviews and document requests
// cancelled, the shortlist refreshed or the endorsement item marked, a Deployed application untouched, the pool entry's
// offers expired, the Supabase ban after the commit, Activate (unban first), lock order, validation and roles.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn(), admin: { updateUserById: vi.fn() } } } }));
vi.mock("../src/lib/svcClient.js", () => ({ matchResume: vi.fn(), extractResume: vi.fn() }));

const { APPLICATION_OUTCOME } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { matchResume } = await import("../src/lib/svcClient.js");
const { LIVE_INTERVIEW_STATUSES } = await import("../src/domain/interview.js");
const { app } = await import("../src/app.js");

const APPLICANT_ID = "a0000000-0000-4000-8000-0000000000a1";
const APPLICANT_USER = "b0000000-0000-4000-8000-0000000000b1";
const VACANCY_ID = "c0000000-0000-4000-8000-0000000000c1";
const APP = "d0000000-0000-4000-8000-0000000000d1"; // the applicant's ongoing application
const WAITING = "d0000000-0000-4000-8000-0000000000d2"; // another applicant waiting in the same group
const POOL_ID = "e0000000-0000-4000-8000-0000000000e1";
const REASON = "Asked to be removed from the agency's list.";

let role;
let target; // findApplicantAccount row (null = unknown applicant)
let apps; // applicationId → { status, userId }
let ongoingAt; // the ongoing application read before the transaction (id or null)
let ongoingUnderLock; // the one read again under the applicant lock (id or null)
let entry; // findActivePoolEntry row (null = no active entry)
let pendingOffers; // rows the offer expiry updates
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const patch = (body, id = APPLICANT_ID) => call("patch", `/api/admin/applicants/${id}/account`).send(body);
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const appMoves = () => txSql("update public.application set status = $3");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const accountWrites = () => txSql("update public.user_account set account_status = $2::public.account_status, deactivation_reason = $3::text");
const lockSequence = () => txCalls.filter((c) => /for update$/.test(c.sql)).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);
const ongoingRow = (id) => (id ? [{ applicationId: id, vacancyId: VACANCY_ID, status: apps[id].status }] : []);

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  target = { applicantId: APPLICANT_ID, userId: APPLICANT_USER, accountStatus: "active" };
  apps = { [APP]: { status: "shortlisted", userId: APPLICANT_USER }, [WAITING]: { status: "waiting_pool", userId: "u-waiting" } };
  ongoingAt = APP;
  ongoingUnderLock = APP;
  entry = null;
  pendingOffers = 0;
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes('p.user_account_id as "userId", u.account_status as "accountStatus"')) return { rows: target ? [{ ...target }] : [] };
    if (sql.includes('select application_id as "applicationId", job_vacancy_id as "vacancyId", status')) return { rows: ongoingRow(ongoingAt) };
    return { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    txCalls.push({ sql: flat, params });
    if (flat.includes("application_cap") && flat.endsWith("for update")) return { rows: [{ status: "open", slotsNeeded: 1, applicationCap: 10, applicationCount: 2 }] };
    if (flat === "select 1 from public.applicant where applicant_id = $1 for update") return { rows: [{}] };
    if (flat.startsWith('select application_id as "applicationId", job_vacancy_id as "vacancyId", status')) return { rows: ongoingRow(ongoingUnderLock) };
    if (flat.includes("from public.application where application_id = $1 for update")) {
      const a = apps[params[0]];
      return { rows: a ? [{ applicationId: params[0], applicantId: APPLICANT_ID, vacancyId: VACANCY_ID, applicantType: "experienced", status: a.status, verificationStartedAt: null, resumeId: "r1" }] : [] };
    }
    if (flat.startsWith("update public.application set status = $3")) {
      const a = apps[params[0]];
      if (!a || a.status !== params[1]) return { rows: [], rowCount: 0 };
      a.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    // shortlist refresh (RANK-02): quota 1 for the group; the closed applicant leaves the one place free
    if (flat.includes('shortlist_per_group as "quota"')) return { rows: [{ quota: 1, jobTitle: "Cashier" }] };
    if (flat.includes('count(*)::int as "occupied"')) return { rows: [{ occupied: 0 }] };
    if (flat.includes('m.matching_score::float as "matchingScore"')) {
      return { rows: apps[WAITING].status === "waiting_pool" ? [{ applicationId: WAITING, status: "waiting_pool", appliedAt: "2030-10-08T01:00:00Z", matchingScore: 70, userId: "u-waiting" }] : [] };
    }
    if (flat.startsWith('select talent_pool_id as "talentPoolId", availability')) return { rows: entry ? [{ ...entry }] : [] };
    if (flat.startsWith("update public.pool_invitation set status = $3")) return { rows: [], rowCount: pendingOffers };
    if (flat.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    return { rows: [], rowCount: 1 };
  });
});

describe("PATCH /api/admin/applicants/:applicantId/account — deactivate (decision 39-4)", () => {
  it("a free applicant (no ongoing application) with a pool entry: offer expired, entry unavailable, account inactive + reason, then the ban", async () => {
    ongoingAt = null;
    ongoingUnderLock = null;
    entry = { talentPoolId: POOL_ID, availability: "invited" };
    pendingOffers = 1;
    const res = await patch({ accountStatus: "inactive", reason: `  ${REASON}  ` });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicantId: APPLICANT_ID, accountStatus: "inactive", closedApplication: null, expiredOffers: 1, signInBlocked: true });
    expect(withTransaction.mock.calls).toHaveLength(1);
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the actor
    expect(lockSequence()).toEqual(["applicant"]); // no ongoing application: no vacancy or application lock
    expect(appMoves()).toEqual([]);
    expect(txSql("update public.pool_invitation set status = $3")[0].params).toEqual([POOL_ID, "pending", "expired"]);
    expect(txSql("update public.talent_pool set availability = $2").map((c) => c.params)).toEqual([[POOL_ID, "unavailable"]]);
    // the reason now lives on the account (decision 39-4), never in talent_pool.remarks
    expect(accountWrites().map((c) => c.params)).toEqual([[APPLICANT_USER, "inactive", REASON, "applicant"]]);
    expect(txSql("remarks")).toEqual([]);
    // the ban after the commit, with the same mechanism as staff (decision 19)
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(APPLICANT_USER, { ban_duration: "876000h" });
    expect(supabaseAdmin.auth.admin.updateUserById.mock.invocationCallOrder[0]).toBeGreaterThan(withTransaction.mock.invocationCallOrder[0]);
    expect(txSql("insert into public.notification")).toEqual([]); // no notice: the applicant cannot sign in (Q4-b)
    expect(JSON.stringify(res.body)).not.toContain(REASON);
  });

  it("a shortlisted application → archived 'Account deactivated' (HR), requests and interviews cancelled, the group's shortlist refreshed as the system", async () => {
    const res = await patch({ accountStatus: "inactive", reason: REASON });
    expect(res.status).toBe(200);
    expect(res.body.data.closedApplication).toEqual({ applicationId: APP, from: "shortlisted" });
    // DATABASE_SCHEMA §8: job_vacancy → applicant → application
    expect(lockSequence().slice(0, 3)).toEqual(["job_vacancy", "applicant", "application"]);
    expect(appMoves().map((m) => m.params)).toEqual([
      [APP, "shortlisted", "archived", "Account deactivated"],
      [WAITING, "waiting_pool", "shortlisted", "shortlist refresh"], // the freed place goes to the next one (BR-11)
    ]);
    // the promotion is the system's: the actor is cleared before it (the deactivation itself is HR's)
    const clear = txCalls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    const archive = txCalls.findIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "archived");
    const promote = txCalls.findIndex((c) => c.sql.startsWith("update public.application set status = $3") && c.params[2] === "shortlisted");
    expect(archive).toBeLessThan(clear);
    expect(clear).toBeLessThan(promote);
    expect(txSql("update public.interview_schedule")[0].params).toEqual([APP, "cancelled", [...LIVE_INTERVIEW_STATUSES]]);
    expect(txSql("update public.document_request").map((c) => c.params)).toEqual([[APP]]);
    // neutral: no pool entry, no item, no notice for the deactivated applicant (only the promoted one is told)
    expect(txSql("insert into public.talent_pool")).toEqual([]);
    expect(txSql("update public.endorsement_item")).toEqual([]);
    expect(txSql("insert into public.notification").map((c) => c.params[0])).toEqual(["u-waiting"]);
    expect(accountWrites().map((c) => c.params)).toEqual([[APPLICANT_USER, "inactive", REASON, "applicant"]]);
    expect(matchResume).not.toHaveBeenCalled(); // no rematch, no svc call
  });

  it.each([["waiting_pool"], ["interview_confirmed"], ["interview_scheduled"]])("%s → archived and the shortlist refreshed", async (status) => {
    apps[APP].status = status;
    const res = await patch({ accountStatus: "inactive", reason: REASON });
    expect(res.status).toBe(200);
    expect(appMoves()[0].params).toEqual([APP, status, "archived", "Account deactivated"]);
    expect(txSql('shortlist_per_group as "quota"')).toHaveLength(1);
    expect(txSql("update public.interview_schedule")).toHaveLength(1);
  });

  it.each([["endorsed"], ["final_interview_scheduled"], ["for_training"], ["for_requirements"], ["for_orientation"], ["for_hiring"]])(
    "with the client (%s) → archived; the endorsement item keeps outcome pending with remarks 'Account deactivated'; no pool, no rematch",
    async (status) => {
      apps[APP].status = status;
      const res = await patch({ accountStatus: "inactive", reason: REASON });
      expect(res.status).toBe(200);
      expect(res.body.data.closedApplication).toEqual({ applicationId: APP, from: status });
      expect(appMoves().map((m) => m.params)).toEqual([[APP, status, "archived", "Account deactivated"]]);
      const [item] = txSql("update public.endorsement_item");
      expect(item.sql).toBe(
        "update public.endorsement_item set outcome_remarks = $2::text where application_id = $1::uuid and outcome = $3::public.endorsement_outcome",
      );
      expect(item.params).toEqual([APP, "Account deactivated", "pending"]);
      expect(txSql("update public.endorsement_item set outcome =")).toEqual([]); // the outcome itself is not recorded
      expect(txSql('shortlist_per_group as "quota"')).toEqual([]); // past the shortlist: no refresh
      expect(txSql("insert into public.talent_pool")).toEqual([]);
      expect(matchResume).not.toHaveBeenCalled();
    },
  );

  it.each([["passed"], ["for_endorsement"], ["passed_awaiting_confirmation"]])("%s → archived; no refresh, no item", async (status) => {
    apps[APP].status = status;
    expect((await patch({ accountStatus: "inactive", reason: REASON })).status).toBe(200);
    expect(appMoves().map((m) => m.params)).toEqual([[APP, status, "archived", "Account deactivated"]]);
    expect(txSql('shortlist_per_group as "quota"')).toEqual([]);
    expect(txSql("update public.endorsement_item")).toEqual([]);
  });

  it("a Deployed (hired) applicant: only the account changes; the hired application is not ongoing and stays (Q4-a)", async () => {
    ongoingAt = null;
    ongoingUnderLock = null;
    const res = await patch({ accountStatus: "inactive", reason: REASON });
    expect(res.status).toBe(200);
    expect(res.body.data.closedApplication).toBeNull();
    const [, params] = pool.query.mock.calls.find(([s]) => s.includes('select application_id as "applicationId", job_vacancy_id as "vacancyId", status'));
    expect(params).toEqual([APPLICANT_ID, [...APPLICATION_OUTCOME.ONGOING]]);
    expect(params[1]).not.toContain("hired");
    expect(appMoves()).toEqual([]);
    expect(accountWrites()).toHaveLength(1);
  });

  it("the ongoing application changed between the read and the lock → 409, nothing written, no ban", async () => {
    ongoingUnderLock = null; // e.g. the vacancy closed it out meanwhile
    const res = await patch({ accountStatus: "inactive", reason: REASON });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This applicant's application changed meanwhile. Refresh the page.");
    expect(writes()).toEqual([]);
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("a failed ban is reported as signInBlocked: false (the inactive status is committed; VERA already refuses the account)", async () => {
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { code: "unexpected", status: 500 } });
    const res = await patch({ accountStatus: "inactive", reason: REASON });
    expect(res.status).toBe(200);
    expect(res.body.data.signInBlocked).toBe(false);
    expect(accountWrites()).toHaveLength(1);
  });
});

describe("PATCH /api/admin/applicants/:applicantId/account — activate (decision 39-4)", () => {
  it("unban first, then account active with no reason and the pool entry available; expired offers and the closed application are not restored", async () => {
    target.accountStatus = "inactive";
    entry = { talentPoolId: POOL_ID, availability: "unavailable" };
    const res = await patch({ accountStatus: "active" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicantId: APPLICANT_ID, accountStatus: "active", signInBlocked: false });
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(APPLICANT_USER, { ban_duration: "none" });
    expect(supabaseAdmin.auth.admin.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(withTransaction.mock.invocationCallOrder[0]);
    expect(lockSequence()).toEqual(["applicant"]);
    expect(txSql("update public.talent_pool set availability = $2").map((c) => c.params)).toEqual([[POOL_ID, "available"]]);
    expect(accountWrites().map((c) => c.params)).toEqual([[APPLICANT_USER, "active", null, "applicant"]]);
    expect(appMoves()).toEqual([]);
    expect(txSql("update public.pool_invitation")).toEqual([]);
  });

  it("an entry that is not unavailable keeps its availability; a refused unban changes nothing (502)", async () => {
    entry = { talentPoolId: POOL_ID, availability: "available" };
    expect((await patch({ accountStatus: "active" })).status).toBe(200);
    expect(txSql("update public.talent_pool")).toEqual([]);

    txCalls = [];
    withTransaction.mockClear();
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { code: "unexpected", status: 500 } });
    const refused = await patch({ accountStatus: "active" });
    expect(refused.status).toBe(502);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/applicants/:applicantId/account — validation and roles", () => {
  it("a reason under 5 characters, missing or over 500, or an unknown status → 400; a bad id → 400; nothing written", async () => {
    for (const body of [
      { accountStatus: "inactive" },
      { accountStatus: "inactive", reason: " no " },
      { accountStatus: "inactive", reason: "x".repeat(501) },
      { accountStatus: "frozen", reason: REASON },
    ]) {
      expect((await patch(body)).status).toBe(400);
    }
    expect((await patch({ accountStatus: "active" }, "not-a-uuid")).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("an unknown applicant → 404; HR and admin may; an applicant token → 403", async () => {
    target = null;
    expect((await patch({ accountStatus: "inactive", reason: REASON })).status).toBe(404);
    target = { applicantId: APPLICANT_ID, userId: APPLICANT_USER, accountStatus: "active" };
    role = "admin";
    expect((await patch({ accountStatus: "inactive", reason: REASON })).status).toBe(200);
    role = "applicant";
    withTransaction.mockClear();
    expect((await patch({ accountStatus: "active" })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
