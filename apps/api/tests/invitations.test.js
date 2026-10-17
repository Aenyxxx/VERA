// Pool matching on publish and job invitations (Phase 3; decision 17, answers 7, 8, 14): the background run (RANK-01
// before svc, MAT-04 with the source type, 15 s timeout, RANK-05), the invite transaction (locks, re-checks, the
// invitation row, the notice), the stored summary and HR notice, one run per vacancy, Run pool matching again, the HR
// read, and the applicant's accept / decline / expire through the shared /applicant/offers endpoints.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/svcClient.js", () => ({ matchResume: vi.fn(), extractResume: vi.fn() }));
vi.mock("../src/domain/shortlist.js", async (importOriginal) => ({
  ...(await importOriginal()),
  refreshShortlist: vi.fn(async () => ({ promoted: [], demoted: [] })),
}));

const { BLOCKS_APPLYING_STATUSES } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { matchResume } = await import("../src/lib/svcClient.js");
const { svcUnavailable } = await import("../src/lib/errors.js");
const { refreshShortlist } = await import("../src/domain/shortlist.js");
const { runPoolMatching, startPoolMatching, POOL_MATCH_TIMEOUT_MS } = await import("../src/modules/invitations/invitations.service.js");
const { app } = await import("../src/app.js");

const VACANCY = "66666666-6666-4666-8666-666666666666";
const OFFER = "c1c1c1c1-0000-4000-8000-000000000001";
const NEW_APP = "a9a9a9a9-0000-4000-8000-000000000009";
const SECTIONS = { skills: "Cash handling", experience: "Cashier" };

let role;
let vacancy; // findVacancyForApply row
let locked; // lockVacancy row
let candidates;
let underLock; // { active, blocking, pending, applied } per applicant id
let duplicate;
let offerRow; // findOffer row (raw, numeric as strings like pg)
let applicantRow;
let failedCompany;
let txCalls;
let poolCalls;

const candidate = (n, extra = {}) => ({
  talentPoolId: `tp${n}`, applicantId: `p${n}`, userId: `u${n}`, applicantType: "experienced",
  age: 25, gender: "female", educationLevel: "college_graduate", heightCm: 250, resumeId: `r${n}`, sections: SECTIONS, ...extra,
});
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const notices = () => txSql("insert into public.notification");

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  vacancy = {
    jobTitle: "ZZ VN", status: "open", requiredSkills: "Cash handling", experienceRequirement: "Cashier",
    minAge: 18, maxAge: 35, genderRequirement: "any", minEducationLevel: "senior_high", minHeightCm: 249, matchingThreshold: 40,
  };
  locked = { status: "open", slotsNeeded: 1, applicationCap: 8, applicationCount: 2 };
  candidates = [];
  underLock = {};
  duplicate = null;
  failedCompany = false;
  applicantRow = { applicantId: "p1", age: 25, gender: "female", educationLevel: "college_graduate", heightCm: 250, resumeId: "r1-new", sections: SECTIONS };
  offerRow = {
    offerId: OFFER, status: "pending", kind: "job_invitation", talentPoolId: "tp1", vacancyId: VACANCY, dueAt: "2030-10-20T00:00:00.000Z",
    applicantType: "experienced", matching: { match: { matchScore: 71.149, modelName: "all-MiniLM-L6-v2", scores: { skills: 80, experience: 62 } }, weights: { skills: 0.5, experience: 0.5 }, matchingScore: 71.15 },
    matchingScore: "71.15", sectionScores: null, interviewScore: null, finalScore: null, ratingsSourceApplicationId: null,
    applicantId: "p1", poolActive: true, userId: USER_ID, applicantName: "Ana Cruz", jobTitle: "ZZ VN", companyName: "ZZ Co",
    passingScore: "75.00", endorsementCount: 1,
  };
  txCalls = [];
  poolCalls = [];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  matchResume.mockResolvedValue({ matchScore: 71.149, modelName: "all-MiniLM-L6-v2", scores: { skills: 80, experience: 62 } });

  const route = (sql, params, db) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    if (db === "pool") poolCalls.push({ sql: flat, params });
    else txCalls.push({ sql: flat, params });
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (flat.includes('as "talentPoolId", tp.applicant_id as "applicantId"')) return { rows: candidates };
    if (flat.includes('as "matchingThreshold"')) return { rows: vacancy ? [vacancy] : [] };
    if (flat.includes('pool_matched_at as "poolMatchedAt"')) {
      return { rows: vacancy ? [{ jobTitle: "ZZ VN", status: vacancy.status, poolMatchedAt: "2030-10-18T01:00:00.000Z", summary: { invited: 1, skipped: 2, failed: 0 } }] : [] };
    }
    if (flat.includes('pi.responded_at as "respondedAt"')) {
      return { rows: [{ invitationId: "i1", applicantName: "Ana Cruz", status: "pending", matchingScore: "71.15", invitedAt: "2030-10-18T00:00:00.000Z", dueAt: "2030-10-21T00:00:00.000Z", respondedAt: null, applicationId: null }] };
    }
    if (flat.includes('pi.pool_invitation_id as "offerId", pi.status, pi.kind')) return { rows: offerRow ? [{ ...offerRow }] : [] };
    if (flat.includes("application_cap") && flat.endsWith("for update")) return { rows: locked ? [{ ...locked }] : [] };
    if (flat.startsWith("select 1 from public.applicant where applicant_id = $1 for update")) return { rows: [] };
    const lock = underLock[params?.[0]] ?? {};
    if (flat.includes("from public.talent_pool where talent_pool_id = $1::uuid and removed_at is null")) return { rows: lock.inactive ? [] : [{}] };
    if (flat.includes("limit 1") && flat.includes("status = any($2::public.application_status[])")) return { rows: lock.blocking ? [{ application_id: "x" }] : [] };
    if (flat.includes('pool_invitation_id as "offerId" from public.pool_invitation where talent_pool_id')) return { rows: lock.pending ? [{ offerId: "o" }] : [] };
    if (flat.startsWith("select 1 from public.application where applicant_id = $1 and job_vacancy_id = $2")) return { rows: lock.applied ? [{}] : [] };
    if (flat.includes("response_deadline_days")) return { rows: [{ days: 3 }] };
    if (flat.startsWith("insert into public.pool_invitation")) {
      if (duplicate) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      return { rows: [{ invitationId: "inv-1", dueAt: "2030-10-21T00:00:00.000Z" }] };
    }
    if (flat.includes('as "blocked"')) return { rows: [{ blocked: failedCompany }] };
    if (flat.includes("from public.v_applicant_profile p")) return { rows: applicantRow ? [applicantRow] : [] };
    if (flat.startsWith("insert into public.application ")) return { rows: [{ applicationId: NEW_APP }] };
    if (flat.startsWith("update public.pool_invitation set status")) {
      if (offerRow.status !== params[1]) return { rows: [], rowCount: 0 };
      offerRow.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    if (flat.startsWith("update public.pool_invitation pi")) return { rows: [] }; // expireJobInvitations: none pending
    return { rows: [], rowCount: 1 };
  };
  pool.query.mockImplementation(async (sql, params) => route(sql, params, "pool"));
  txClient.query.mockImplementation(async (sql, params) => route(sql, params, "tx"));
});

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");

// ---------------------------------------------------------------- the background run

describe("runPoolMatching (RANK-05, decision 17c/d)", () => {
  it("prescreen before svc, the source type's weights, a 15 s timeout; invites who qualifies; stores and sends the summary", async () => {
    candidates = [
      candidate(1), // qualifies: 71.149 → 71.15 ≥ 40
      candidate(2, { heightCm: 160 }), // prescreen fails (min height 249): no svc call
      candidate(3, { applicantType: "first_time" }), // below the threshold
      candidate(4), // svc down / timeout
    ];
    matchResume
      .mockResolvedValueOnce({ matchScore: 71.149, modelName: "all-MiniLM-L6-v2" })
      .mockResolvedValueOnce({ matchScore: 21.4, modelName: "all-MiniLM-L6-v2" })
      .mockRejectedValueOnce(svcUnavailable());

    const summary = await runPoolMatching(USER_ID, VACANCY);
    expect(summary).toEqual({ invited: 1, skipped: 2, failed: 1, finishedAt: expect.any(String) });
    expect(POOL_MATCH_TIMEOUT_MS).toBe(15000);

    // svc: never for p2 (prescreen), each call with the source application's weights and the 15 s timeout
    expect(matchResume.mock.calls).toEqual([
      [{ sections: SECTIONS, job: { skills: "Cash handling", experience: "Cashier" }, weights: { skills: 0.5, experience: 0.5 } }, { timeoutMs: 15000 }],
      [{ sections: SECTIONS, job: { skills: "Cash handling", experience: "Cashier" }, weights: { skills: 1, experience: 0 } }, { timeoutMs: 15000 }],
      [{ sections: SECTIONS, job: { skills: "Cash handling", experience: "Cashier" }, weights: { skills: 0.5, experience: 0.5 } }, { timeoutMs: 15000 }],
    ]);
    // svc runs outside transactions: one invite transaction + the summary transaction only
    expect(withTransaction).toHaveBeenCalledTimes(2);

    // the candidate query: free entries, nothing pending, never this vacancy, never applied, 1-year company block
    const query = poolCalls.find((c) => c.sql.includes('as "talentPoolId", tp.applicant_id'));
    expect(query.params).toEqual([VACANCY, BLOCKS_APPLYING_STATUSES, "pending", ["did_not_pass", "not_hired", "training_failed", "dropped"]]);
    expect(query.sql).toContain("tp.removed_at is null");
    expect(query.sql).toContain("q.talent_pool_id = tp.talent_pool_id and q.status = $3::public.invitation_status");
    expect(query.sql).toContain("q.job_vacancy_id = v.job_vacancy_id");
    expect(query.sql).toContain("o.applicant_id = tp.applicant_id and o.job_vacancy_id = v.job_vacancy_id");
    expect(query.sql).toContain("fp.user_account_id = p.user_account_id");
    expect(query.sql).toContain("fa.status_changed_at > now() - make_interval(years => 1)");

    // the invite: job_vacancy → applicant locks, then the row (kind job_invitation, stored matching), invited, notice
    const vacancyLock = txCalls.findIndex((c) => c.sql.includes("application_cap") && c.sql.endsWith("for update"));
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select 1 from public.applicant where applicant_id = $1 for update"));
    const [insert] = txSql("insert into public.pool_invitation");
    expect(vacancyLock).toBe(0);
    expect(applicantLock).toBeGreaterThan(vacancyLock);
    expect(txCalls.indexOf(insert)).toBeGreaterThan(applicantLock);
    expect(insert.params).toEqual([
      "tp1", VACANCY, "pending", "job_invitation", USER_ID, expect.any(Date), "experienced",
      JSON.stringify({ match: { matchScore: 71.149, modelName: "all-MiniLM-L6-v2" }, weights: { skills: 0.5, experience: 0.5 }, matchingScore: 71.15 }),
      71.15,
    ]);
    expect(txSql("update public.talent_pool set availability").map((c) => c.params)).toEqual([["tp1", "invited"]]);
    const [invitation, finished] = notices();
    expect(invitation.params.slice(0, 4)).toEqual(["u1", null, "job_invitation", "Job invitation: ZZ VN"]);
    expect(invitation.params[4]).toMatch(/^The agency found a job that fits your profile: ZZ VN\. Do you want to apply\? Please answer on your dashboard by .+ \(Philippine time\)\.$/);
    expect(invitation.params[6]).toBe(true); // requires action
    expect(`${invitation.params[3]} ${invitation.params[4]}`).not.toMatch(/ZZ Co|score|71/i);

    // the summary is stored and HR is told
    const [stored] = txSql("update public.job_vacancy set pool_matched_at = now()");
    expect(stored.params[0]).toBe(VACANCY);
    expect(JSON.parse(stored.params[1])).toEqual(summary);
    expect(finished.sql).toContain("from public.user_account");
    expect(finished.params.slice(3, 6)).toEqual(["hr_pool_matching_finished", "Pool matching finished: ZZ VN", "1 invited, 2 skipped, 1 failed."]);
  });

  it.each([
    ["the pool entry was replaced", { inactive: true }],
    ["the applicant applied elsewhere meanwhile (BR-17)", { blocking: true }],
    ["a pending offer or invitation appeared on the entry", { pending: true }],
    ["the applicant applied to this vacancy meanwhile", { applied: true }],
  ])("re-checked under the locks: %s → skipped, nothing written for them", async (_label, lock) => {
    candidates = [candidate(1)];
    underLock = { tp1: lock, p1: lock };
    const summary = await runPoolMatching(USER_ID, VACANCY);
    expect(summary).toMatchObject({ invited: 0, skipped: 1, failed: 0 });
    expect(txSql("insert into public.pool_invitation")).toEqual([]);
    expect(txSql("update public.talent_pool")).toEqual([]);
  });

  it("23505 on the one-pending index → skipped (another writer answered first)", async () => {
    candidates = [candidate(1)];
    duplicate = "pool_invitation_one_pending";
    expect(await runPoolMatching(USER_ID, VACANCY)).toMatchObject({ invited: 0, skipped: 1, failed: 0 });
  });

  it("the job left open during the run → the run stops: no invitation, no more svc calls", async () => {
    candidates = [candidate(1), candidate(5)];
    locked = { ...locked, status: "closed" };
    expect(await runPoolMatching(USER_ID, VACANCY)).toMatchObject({ invited: 0, skipped: 0, failed: 0 });
    expect(matchResume).toHaveBeenCalledTimes(1);
    expect(txSql("insert into public.pool_invitation")).toEqual([]);
  });

  it("a vacancy that is not open → no run at all (null)", async () => {
    vacancy = { ...vacancy, status: "closed" };
    expect(await runPoolMatching(USER_ID, VACANCY)).toBe(null);
    expect(poolCalls.some((c) => c.sql.includes('as "talentPoolId"'))).toBe(false);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("one run per vacancy: a second start while running returns null; the flag clears when the run ends", async () => {
    candidates = [candidate(1)];
    let release;
    matchResume.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = startPoolMatching(USER_ID, VACANCY);
    expect(first).toBeInstanceOf(Promise);
    expect(startPoolMatching(USER_ID, VACANCY)).toBe(null);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release({ matchScore: 71.149, modelName: "all-MiniLM-L6-v2" });
    await first;
    const again = startPoolMatching(USER_ID, VACANCY);
    expect(again).toBeInstanceOf(Promise);
    await again;
  });
});

// ---------------------------------------------------------------- HR endpoints

describe("POST /api/admin/vacancies/:id/pool-matching and GET /invitations (HR)", () => {
  it("Run pool matching again → 202 started (the run happens in the background)", async () => {
    const res = await call("post", `/api/admin/vacancies/${VACANCY}/pool-matching`);
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ status: "started" });
    await vi.waitFor(() => expect(txSql("update public.job_vacancy set pool_matched_at = now()")).toHaveLength(1));
  });

  it("not open → 409; unknown → 404; applicant → 403", async () => {
    vacancy = { ...vacancy, status: "endorsing" };
    const res = await call("post", `/api/admin/vacancies/${VACANCY}/pool-matching`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Pool matching runs only for an open job.");
    vacancy = null;
    expect((await call("post", `/api/admin/vacancies/${VACANCY}/pool-matching`)).status).toBe(404);
    role = "applicant";
    expect((await call("post", `/api/admin/vacancies/${VACANCY}/pool-matching`)).status).toBe(403);
    expect((await call("get", `/api/admin/vacancies/${VACANCY}/invitations`)).status).toBe(403);
  });

  it("GET /invitations → running, the last summary, and the job invitations (numbers as numbers)", async () => {
    const res = await call("get", `/api/admin/vacancies/${VACANCY}/invitations`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      running: false,
      poolMatchedAt: "2030-10-18T01:00:00.000Z",
      summary: { invited: 1, skipped: 2, failed: 0 },
      invitations: [{ invitationId: "i1", applicantName: "Ana Cruz", status: "pending", matchingScore: 71.15, invitedAt: "2030-10-18T00:00:00.000Z", dueAt: "2030-10-21T00:00:00.000Z", respondedAt: null, applicationId: null }],
    });
    const list = poolCalls.find((c) => c.sql.includes('pi.responded_at as "respondedAt"'));
    expect(list.params).toEqual([VACANCY, "job_invitation"]);
  });
});

// ---------------------------------------------------------------- applicant answer

describe("POST /api/applicant/offers/:id/accept | /decline for a job invitation (decision 17e)", () => {
  beforeEach(() => {
    role = "applicant";
  });
  const answer = (verb) => call("post", `/api/applicant/offers/${OFFER}/${verb}`);

  it("accept → a normal application (waiting_pool, source talent_pool, the stored matching), pool entry closed, HR told", async () => {
    const res = await answer("accept");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      offerId: OFFER, status: "accepted", applicationId: NEW_APP, applicationStatus: "waiting_pool",
      message: "Your application for ZZ VN was received. You are in line for document review.",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ZZ Co|companyName|matchingScore|71/);

    const vacancyLock = txCalls.findIndex((c) => c.sql.includes("application_cap") && c.sql.endsWith("for update"));
    const applicantLock = txCalls.findIndex((c) => c.sql.startsWith("select 1 from public.applicant where applicant_id = $1 for update"));
    expect([vacancyLock, applicantLock > vacancyLock]).toEqual([0, true]);
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);

    const [insert] = txSql("insert into public.application ");
    expect(insert.params).toEqual(["p1", VACANCY, "r1-new", "experienced", "waiting_pool", "Accepted job invitation", "talent_pool"]);
    expect(txSql("insert into public.matching_result")[0].params.slice(0, 2)).toEqual([NEW_APP, 71.15]);
    expect(txSql("update public.pool_invitation set status")[0].params).toEqual([OFFER, "pending", "accepted", NEW_APP]);
    expect(txSql("update public.talent_pool set removed_at = now(), availability")[0].params).toEqual(["tp1", "reapplied"]);
    expect(refreshShortlist).toHaveBeenCalledWith(txClient, VACANCY, "experienced");
    // notify: [user, application, type, …]; notifyStaff: [roles, status, application, type, …]
    const typeOf = (n) => (n.sql.includes("from public.user_account") ? n.params[3] : n.params[2]);
    expect(notices().map(typeOf)).toEqual(["application_submitted", "hr_invitation_accepted"]);
    expect(matchResume).not.toHaveBeenCalled(); // answer 7: no svc on accept
    expect(txSql("update public.job_vacancy set status")).toEqual([]); // cap not reached
  });

  it("accept that is promoted → shortlisted; the place that reaches the cap closes the job and ends its other invitations", async () => {
    refreshShortlist.mockResolvedValueOnce({ promoted: [NEW_APP], demoted: [] });
    locked = { ...locked, applicationCount: 7, applicationCap: 8 };
    const res = await answer("accept");
    expect(res.body.data).toMatchObject({ status: "accepted", applicationStatus: "shortlisted" });
    expect(txSql("update public.job_vacancy set status")[0].params.slice(0, 2)).toEqual([VACANCY, "closed"]);
    const accepted = txCalls.findIndex((c) => c.sql.startsWith("update public.pool_invitation set status"));
    const expired = txCalls.findIndex((c) => c.sql.startsWith("update public.pool_invitation pi"));
    expect(expired).toBeGreaterThan(accepted); // this invitation is accepted first, so it is never expired
  });

  it.each([
    ["the job is no longer open", () => { locked = { ...locked, status: "closed" }; }],
    ["the cap is full", () => { locked = { ...locked, applicationCount: 8 }; }],
    ["an ongoing application elsewhere (BR-17)", () => { underLock.p1 = { blocking: true }; }],
    ["a failed company within 1 year (BR-19)", () => { failedCompany = true; }],
    ["already applied there (BR-14)", () => { underLock.p1 = { applied: true }; }],
    ["the profile no longer passes the prescreen", () => { applicantRow = { ...applicantRow, heightCm: 160 }; }],
    ["HR raised the threshold above the stored score", () => { vacancy = { ...vacancy, matchingThreshold: 80 }; }],
    ["the pool entry was replaced", () => { offerRow.poolActive = false; }],
  ])("re-check fails (%s) → invitation expired (committed), entry available, neutral notice, 409", async (_label, arrange) => {
    arrange();
    const res = await answer("accept");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This job is no longer available. You can apply to other jobs.");
    expect(txSql("update public.pool_invitation set status")[0].params).toEqual([OFFER, "pending", "expired", null]);
    expect(txSql("update public.talent_pool set availability")[0].params).toEqual(["tp1", "available"]);
    expect(notices().map((n) => n.params.slice(2, 4))).toEqual([["job_invitation_expired", "Job no longer available: ZZ VN"]]);
    expect(txSql("insert into public.application ")).toEqual([]);
  });

  it("decline → declined, stays in the pool (available), HR told; no application", async () => {
    const res = await answer("decline");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ offerId: OFFER, status: "declined" });
    expect(txSql("update public.pool_invitation set status")[0].params).toEqual([OFFER, "pending", "declined", null]);
    expect(txSql("update public.talent_pool set availability")[0].params).toEqual(["tp1", "available"]);
    const [staff] = notices();
    expect(notices()).toHaveLength(1);
    expect(staff.sql).toContain("from public.user_account"); // staff only: the applicant gets nothing for their own decline
    expect(staff.params.slice(3, 6)).toEqual(["hr_invitation_declined", "Invitation declined: Ana Cruz", "Ana Cruz declined the invitation to ZZ VN at ZZ Co."]);
    expect(txSql("insert into public.application ")).toEqual([]);
  });

  it("an answered invitation → 409 and nothing written; someone else's → 404", async () => {
    offerRow.status = "declined";
    expect((await answer("accept")).status).toBe(409);
    expect(writes()).toEqual([]);
    offerRow.status = "pending";
    offerRow.userId = "someone-else";
    expect((await answer("accept")).status).toBe(404);
  });
});
