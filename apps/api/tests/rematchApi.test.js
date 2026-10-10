// Automatic rematch after not_hired (S17; PRD BR-23, FR-END-10, FR-POOL-01; RANK-04): the scan (prescreen, svc /match
// per vacancy BEFORE the transaction, threshold, original ratings × the vacancy's weights, RANK-04 rank 1), the offer
// under the applicant lock, the applicant's accept / decline under job_vacancy → applicant, the re-check that expires
// the offer (committed) with a 409, the named 23505 fallbacks, the pool view, roles, and no company / score for the
// applicant.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/svcClient.js", () => ({ matchResume: vi.fn(), extractResume: vi.fn() }));

const { BLOCKS_APPLYING_STATUSES, finalScore, isPassed, overallRating, resolveMatchingWeights } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { matchResume } = await import("../src/lib/svcClient.js");
const { svcUnavailable } = await import("../src/lib/errors.js");
const { runRematchAfterNotHired } = await import("../src/modules/rematch/rematch.service.js");
const { app } = await import("../src/app.js");

const NOT_HIRED_APP = "a1a1a1a1-0000-4000-8000-000000000001";
const RATINGS_SRC = "a0a0a0a0-0000-4000-8000-000000000000"; // the original interview (Cashier)
const NEW_APP = "a9a9a9a9-0000-4000-8000-000000000009";
const POOL_ID = "70707070-0000-4000-8000-000000000007";
const OFFER_ID = "c1c1c1c1-0000-4000-8000-000000000001";
const APPLICANT_ID = "p1p1p1p1-0000-4000-8000-000000000001";
const RESUME_ID = "r1r1r1r1-0000-4000-8000-000000000001";
const V_BEST = "11111111-0000-4000-8000-000000000001";
const V_STORE = "22222222-0000-4000-8000-000000000002";
const V_OLD = "33333333-0000-4000-8000-000000000003"; // prescreen fails (age)
const V_HIGH_PASS = "44444444-0000-4000-8000-000000000004"; // passing 100 → below_passing
const DUE = "2026-10-13T12:00:00.000Z";

// Juan's demo ratings (ALGORITHM §6) on a 3 / 9 / 3 rubric.
const JUAN = { A: [5, 4, 4], B: [5, 5, 5, 4, 4, 4, 4, 4, 4], C: [4, 4, 4] };
const RUBRIC = Object.entries(JUAN).map(([code, list]) => ({
  sectionCode: code,
  sectionName: `Section ${code}`,
  items: list.map((_, i) => ({ competencyId: `c-${code}-${i}`, competencyName: `${code}${i}` })),
}));
const RATINGS = Object.entries(JUAN).flatMap(([code, list]) => list.map((rating, i) => ({ competency_id: `c-${code}-${i}`, rating })));
const WEIGHTS = {
  [V_BEST]: { A: 30, B: 30, C: 40 }, // Cashier weights → interview 80.00
  [V_STORE]: { A: 20, B: 80, C: 0 }, // Store Crew weights → interview 83.33
  [V_OLD]: { A: 30, B: 30, C: 40 },
  [V_HIGH_PASS]: { A: 30, B: 30, C: 40 },
};
const SVC_SCORE = { [V_BEST]: 99.381, [V_STORE]: 71.149, [V_HIGH_PASS]: 99.38 };

const vacancyRow = (vacancyId, jobTitle, companyName, extra = {}) => ({
  vacancyId, jobTitle, companyName,
  requiredSkills: "Cash handling, customer service", experienceRequirement: "Retail cashier", minYearsExperience: 1,
  minAge: null, maxAge: null, genderRequirement: "any", minEducationLevel: null, minHeightCm: null,
  matchingThreshold: 40, passingScore: 75,
  ...extra,
});

let role;
let source; // findRematchSource row
let blocking; // findBlocking row (null = free)
let pendingOffer; // findPendingOffer row (null = none)
let pendingUnderLock; // pending offer that appears only inside the transaction (race)
let vacancies; // listRematchVacancies rows
let applicant; // findApplicantForApply row
let offer; // findOffer row
let vacancyLocked; // lockVacancy row
let vacancyForApply; // findVacancyForApply row
let committed;
let atFailed;
let applied;
let duplicate; // { on, constraint } → 23505
let storedFinalDelta; // FIN-01 mismatch injection
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const runCall = () => call("post", `/api/admin/applications/${NOT_HIRED_APP}/rematch`).send({});
const answer = (verb) => call("post", `/api/applicant/offers/${OFFER_ID}/${verb}`).send({});
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const notices = () => txSql("insert into public.notification (user_account_id, application_id, notification_type, title, message, link_path, requires_action)");
const staffNotices = () => txSql("select user_account_id, $3, $4, $5, $6, $7");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
const lockSequence = () => txCalls.filter((c) => /for update$/.test(c.sql)).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);
const pending = () => ({ offerId: OFFER_ID });

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  source = {
    applicationId: NOT_HIRED_APP, status: "not_hired", applicantId: APPLICANT_ID, applicantType: "experienced", userId: USER_ID,
    applicantName: "Juan Dela Cruz", ratingsSourceApplicationId: RATINGS_SRC, vacancyId: "cashier",
    talentPoolId: POOL_ID, poolSourceApplicationId: NOT_HIRED_APP,
  };
  blocking = null;
  pendingOffer = null;
  pendingUnderLock = null;
  vacancies = [
    vacancyRow(V_BEST, "ZZ Best", "ZZ Co"),
    vacancyRow(V_STORE, "Store Crew", "ClayGo"),
    vacancyRow(V_OLD, "ZZ Old", "ZZ Co", { minAge: 40 }),
    vacancyRow(V_HIGH_PASS, "ZZ Low", "ZZ Co", { passingScore: 100 }),
  ];
  applicant = { applicantId: APPLICANT_ID, age: 25, gender: "male", educationLevel: "college_graduate", heightCm: 170, resumeId: RESUME_ID, sections: { skills: "Cash handling" } };
  offer = {
    offerId: OFFER_ID, status: "pending", talentPoolId: POOL_ID, vacancyId: V_BEST, dueAt: DUE, applicantType: "experienced",
    matching: { match: { matchScore: 99.381, modelName: "all-MiniLM-L6-v2", scores: { skills: 99, experience: 99.7 } }, weights: { skills: 50, experience: 50 }, matchingScore: 99.38 },
    matchingScore: 99.38, sectionScores: { A: 83.33, B: 83.33, C: 75 }, interviewScore: 80, finalScore: 89.69,
    ratingsSourceApplicationId: RATINGS_SRC, applicantId: APPLICANT_ID, poolActive: true, userId: USER_ID,
    applicantName: "Juan Dela Cruz", jobTitle: "ZZ Best", companyName: "ZZ Co", passingScore: 75, endorsementCount: 1,
  };
  vacancyLocked = { status: "open", slotsNeeded: 1, applicationCap: 10, applicationCount: 0 };
  vacancyForApply = vacancyRow(V_BEST, "ZZ Best", "ZZ Co", { status: "open" });
  committed = 0;
  atFailed = false;
  applied = false;
  duplicate = null;
  storedFinalDelta = 0;
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  matchResume.mockImplementation(async ({ job }) => {
    const v = vacancies.find((x) => x.requiredSkills === job.skills && SVC_SCORE[x.vacancyId] !== undefined && !x.used);
    v.used = true;
    return { matchScore: SVC_SCORE[v.vacancyId], modelName: "all-MiniLM-L6-v2", scores: { skills: 90, experience: 90 } };
  });

  // Reads shared by the pool (before the transaction) and the transaction client (re-checks under the locks).
  const read = (sql, params) => {
    if (sql.includes('as "poolSourceApplicationId"')) return { rows: source && params[0] === NOT_HIRED_APP ? [{ ...source }] : [] };
    if (sql.includes("select application_id from public.application")) return { rows: blocking ? [blocking] : [] };
    if (sql.includes('select pool_invitation_id as "offerId" from public.pool_invitation')) return { rows: pendingOffer ? [pendingOffer] : [] };
    if (sql.includes("from public.v_applicant_profile")) return { rows: applicant ? [{ ...applicant }] : [] };
    if (sql.includes("from public.competency_rating")) return { rows: RATINGS.map((r) => ({ competencyId: r.competency_id, rating: r.rating })) };
    if (sql.includes("left join public.job_section_weight")) {
      return { rows: Object.entries(WEIGHTS[params[0]]).map(([sectionCode, weight]) => ({ sectionCode, sectionName: sectionCode, weight, items: [] })) };
    }
    if (sql.includes("from public.competency_section s")) {
      return { rows: RUBRIC.flatMap((s) => s.items.map((i) => ({ sectionCode: s.sectionCode, sectionName: s.sectionName, ...i }))) };
    }
    if (sql.includes("not exists (select 1 from public.pool_invitation pi")) return { rows: vacancies.map((v) => ({ ...v })) };
    if (sql.includes("where pi.pool_invitation_id = $1::uuid")) {
      return { rows: offer && params[0] === OFFER_ID ? [{ ...offer, matchingScore: String(offer.matchingScore), passingScore: String(offer.passingScore) }] : [] };
    }
    if (sql.includes('pi.invited_at as "offeredAt"')) {
      return { rows: [{ offerId: OFFER_ID, jobTitle: "ZZ Best", deploymentLocation: "Quezon City", employmentType: "contractual", dueAt: DUE, offeredAt: "2026-10-10T12:00:00Z" }] };
    }
    if (sql.includes("left join lateral") && sql.includes("from public.talent_pool tp")) {
      return { rows: [{ talentPoolId: POOL_ID, applicantName: "Juan Dela Cruz", offerStatus: "pending", offerCompanyName: "ZZ Co" }] };
    }
    if (sql.includes('as "blocked"')) return { rows: [{ blocked: atFailed }] };
    if (sql.includes("select 1 from public.application where applicant_id = $1 and job_vacancy_id = $2")) return { rows: applied ? [{}] : [] };
    if (sql.includes('v.matching_threshold::float as "matchingThreshold"') && sql.includes("where v.job_vacancy_id = $1")) {
      return { rows: vacancyForApply ? [{ ...vacancyForApply }] : [] };
    }
    if (sql.includes('as "committed"')) return { rows: [{ committed }] };
    return null;
  };

  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    return read(sql, params) ?? { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    txCalls.push({ sql: flat, params });
    if (flat.startsWith('select pool_invitation_id as "offerId" from public.pool_invitation') && pendingUnderLock) return { rows: [pendingUnderLock] };
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: vacancyLocked ? [{ ...vacancyLocked }] : [] };
    if (flat.startsWith("select 1 from public.applicant where applicant_id = $1 for update")) return { rows: [{}] };
    if (sql.includes("from public.system_setting")) return { rows: [{ days: 3 }] };
    const hit = read(sql, params);
    if (hit) return hit;
    const maybeDuplicate = (needle) => {
      if (duplicate?.on === needle) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate.constraint });
    };
    if (flat.startsWith("insert into public.pool_invitation")) {
      maybeDuplicate("offer");
      return { rows: [{ offerId: OFFER_ID, dueAt: DUE }] };
    }
    if (flat.startsWith("insert into public.application ")) {
      maybeDuplicate("application");
      return { rows: [{ applicationId: NEW_APP }] };
    }
    if (flat.startsWith("insert into public.final_evaluation")) {
      const [, m, i, p, sections, src] = params;
      const final = finalScore(Number(m), Number(i)) + storedFinalDelta;
      return {
        rows: [{
          matchingScore: m, interviewScore: i, passingScore: p, finalScore: String(final), passed: isPassed(final, Number(p)),
          overallRating: overallRating(Number(i)), sectionScores: JSON.parse(sections), sourceApplicationId: src, computedAt: "now",
        }],
      };
    }
    if (flat.startsWith("update public.pool_invitation")) {
      if (offer.status !== params[1]) return { rows: [], rowCount: 0 };
      offer.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
});

// ---------------------------------------------------------------- scan + offer

describe("POST /api/admin/applications/:id/rematch — scan and automatic offer (BR-23, RANK-04)", () => {
  it("offers rank 1 (highest matching), with numbers HR can explain; svc runs before the transaction", async () => {
    const res = await runCall();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: "offered", offerId: OFFER_ID, vacancyId: V_BEST, jobTitle: "ZZ Best", companyName: "ZZ Co",
      matchingScore: 99.38, interviewScore: 80, finalScore: 89.69, dueAt: DUE,
    });

    // candidate vacancies: open, failed companies, endorsement commitments, this applicant, this pool entry
    const [, listParams] = pool.query.mock.calls.find(([s]) => s.includes("not exists (select 1 from public.pool_invitation pi"));
    expect(listParams).toEqual(["open", USER_ID, ["did_not_pass", "not_hired", "training_failed", "dropped"], ["passed_awaiting_confirmation", "for_endorsement", "endorsed"], APPLICANT_ID, POOL_ID]);

    // prescreen first (V_OLD never reaches svc); every other vacancy matched with the CARRIED-OVER type's weights
    expect(matchResume).toHaveBeenCalledTimes(3);
    const experienced = resolveMatchingWeights("experienced", vacancies[0]);
    expect(matchResume.mock.calls.map(([input]) => input.weights)).toEqual([experienced, experienced, experienced]);
    expect(matchResume.mock.calls[0][0]).toEqual({
      sections: applicant.sections,
      job: { skills: vacancies[0].requiredSkills, experience: "Retail cashier", minYears: 1 },
      weights: experienced,
    });
    expect(Math.max(...matchResume.mock.invocationCallOrder)).toBeLessThan(withTransaction.mock.invocationCallOrder[0]);

    // the offer row: pending, the stored (rounded) matching, the original interview as the ratings source
    const [insert] = txSql("insert into public.pool_invitation");
    expect(insert.params[0]).toBe(POOL_ID);
    expect(insert.params[1]).toBe(V_BEST);
    expect(insert.params[2]).toBe("pending");
    expect(new Date(insert.params[3]).getTime() - Date.now()).toBeGreaterThan(3 * 24 * 3600 * 1000 - 60_000);
    expect(insert.params.slice(4)).toEqual([
      "experienced",
      JSON.stringify({ match: { matchScore: 99.381, modelName: "all-MiniLM-L6-v2", scores: { skills: 90, experience: 90 } }, weights: experienced, matchingScore: 99.38 }),
      99.38,
      JSON.stringify({ A: 83.33, B: 83.33, C: 75 }),
      80,
      89.69,
      RATINGS_SRC,
    ]);
    expect(txSql("update public.talent_pool set availability = $2").map((c) => c.params)).toEqual([[POOL_ID, "invited"]]);

    // applicant: job title and deadline only; staff: may name the company
    const [note] = notices();
    expect(note.params.slice(0, 4)).toEqual([USER_ID, null, "rematch_offer", "Another job for you: ZZ Best"]);
    expect(note.params[4]).toContain("Please answer on your dashboard by");
    expect(note.params[6]).toBe(true);
    expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/ZZ Co|ClayGo|company|score|99|89|%/i);
    const [staff] = staffNotices();
    expect(staff.params.slice(2, 5)).toEqual([NOT_HIRED_APP, "hr_rematch_offered", "Rematch offer: Juan Dela Cruz"]);
    expect(staff.params[5]).toContain("ZZ Best job at ZZ Co");

    // only the applicant row is locked; actor = HR
    expect(lockSequence()).toEqual(["applicant"]);
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);
  });

  it("Store Crew wins when it is the only kept vacancy (Juan's demo: 71.15 / 83.33 / 77.24)", async () => {
    vacancies = [vacancyRow(V_STORE, "Store Crew", "ClayGo"), vacancyRow(V_HIGH_PASS, "ZZ Low", "ZZ Co", { passingScore: 100, requiredSkills: "Other" })];
    const res = await runCall();
    expect(res.body.data).toMatchObject({ status: "offered", vacancyId: V_STORE, matchingScore: 71.15, interviewScore: 83.33, finalScore: 77.24 });
  });

  it("nothing kept (below threshold / below passing / prescreen) → no_match, no transaction", async () => {
    vacancies = [vacancyRow(V_OLD, "ZZ Old", "ZZ Co", { minAge: 40 }), vacancyRow(V_HIGH_PASS, "ZZ Low", "ZZ Co", { passingScore: 100 })];
    const res = await runCall();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "no_match" });
    expect(withTransaction.mock.calls).toEqual([]);
  });

  it("a vacancy whose section weights do not total 100 is skipped, the rest still ranks", async () => {
    WEIGHTS[V_BEST] = { A: 30, B: 30, C: 30 };
    try {
      const res = await runCall();
      expect(res.body.data).toMatchObject({ status: "offered", vacancyId: V_STORE });
    } finally {
      WEIGHTS[V_BEST] = { A: 30, B: 30, C: 40 };
    }
  });

  it.each([
    ["not not_hired", () => { source.status = "hired"; }, 409],
    ["pool entry from another application", () => { source.poolSourceApplicationId = RATINGS_SRC; }, 409],
    ["no active pool entry", () => { source.talentPoolId = null; }, 409],
    ["ongoing application elsewhere", () => { blocking = { application_id: NEW_APP }; }, 409],
    ["already a pending offer", () => { pendingOffer = pending(); }, 409],
    ["unknown application", () => { source = null; }, 404],
  ])("%s → %i before any svc call or write", async (_label, arrange, status) => {
    arrange();
    const res = await runCall();
    expect(res.status).toBe(status);
    expect(matchResume.mock.calls).toEqual([]);
    expect(withTransaction.mock.calls).toEqual([]);
  });

  it("a pending offer that appears while matching ran → 409 under the lock, nothing written", async () => {
    pendingUnderLock = pending();
    const res = await runCall();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This applicant already has a pending rematch offer.");
    expect(writes()).toEqual([]);
  });

  it.each([
    ["pool_invitation_one_pending", "This applicant already has a pending rematch offer."],
    ["pool_invitation_talent_pool_id_job_vacancy_id_key", "This job was already offered to this applicant."],
  ])("23505 %s → 409", async (constraint, message) => {
    duplicate = { on: "offer", constraint };
    const res = await runCall();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(message);
  });

  it("another 23505 stays a 500", async () => {
    duplicate = { on: "offer", constraint: "some_other_key" };
    expect((await runCall()).status).toBe(500);
  });

  it("svc down → 503 for Run rematch again; the not_hired hook answers { status: failed } instead of throwing", async () => {
    matchResume.mockRejectedValue(svcUnavailable());
    expect((await runCall()).status).toBe(503);
    expect(await runRematchAfterNotHired(USER_ID, NOT_HIRED_APP)).toEqual({ status: "failed" });
    expect(withTransaction.mock.calls).toEqual([]);
  });

  it("the hook returns the offer summary (no numbers) or no_match", async () => {
    expect(await runRematchAfterNotHired(USER_ID, NOT_HIRED_APP)).toEqual({ status: "offered", offerId: OFFER_ID, jobTitle: "ZZ Best", companyName: "ZZ Co" });
    vacancies = [];
    expect(await runRematchAfterNotHired(USER_ID, NOT_HIRED_APP)).toEqual({ status: "no_match" });
  });

  it("roles: applicant → 403; bad id → 400", async () => {
    role = "applicant";
    expect((await runCall()).status).toBe(403);
    role = "hr";
    expect((await call("post", "/api/admin/applications/nope/rematch").send({})).status).toBe(400);
  });
});

// ---------------------------------------------------------------- accept / decline

describe("POST /api/applicant/offers/:id/accept | /decline (BR-23)", () => {
  beforeEach(() => {
    role = "applicant";
  });

  it("accept → application (source rematch) at for_endorsement with matching_result and final_evaluation from the offer", async () => {
    const res = await answer("accept");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ offerId: OFFER_ID, status: "accepted", applicationId: NEW_APP, applicationStatus: "for_endorsement" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);

    // lock order: job_vacancy → applicant
    expect(lockSequence()).toEqual(["job_vacancy", "applicant"]);
    expect(txCalls[0].params[0]).toBe(V_BEST);
    expect(txSql("select 1 from public.applicant where applicant_id = $1 for update")[0].params).toEqual([APPLICANT_ID]);

    const [insertApp] = txSql("insert into public.application ");
    expect(insertApp.params).toEqual([APPLICANT_ID, V_BEST, RESUME_ID, "experienced", "for_endorsement", "Accepted rematch offer", "rematch"]);
    const [matching] = txSql("insert into public.matching_result");
    expect(matching.params[0]).toBe(NEW_APP);
    expect(matching.params[1]).toBe(99.38);
    expect(matching.params[11]).toBe("all-MiniLM-L6-v2");
    const [evaluation] = txSql("insert into public.final_evaluation");
    expect(evaluation.params).toEqual([NEW_APP, 99.38, 80, 75, JSON.stringify({ A: 83.33, B: 83.33, C: 75 }), RATINGS_SRC, null]);

    const offerUpdates = txSql("update public.pool_invitation").map((c) => c.params);
    expect(offerUpdates).toEqual([[OFFER_ID, "pending", "accepted", NEW_APP]]);
    expect(txSql("update public.talent_pool set removed_at = now()").map((c) => c.params)).toEqual([[POOL_ID, "reapplied"]]);
    const [staff] = staffNotices();
    expect(staff.params.slice(2, 5)).toEqual([NEW_APP, "hr_rematch_accepted", "Rematch accepted: Juan Dela Cruz"]);
    expect(staff.params[6]).toBe(`/admin/endorsements/${V_BEST}`);
    expect(notices()).toEqual([]); // the applicant gets the answer in the response
  });

  it("a second accept → 409 (offer already accepted), nothing written", async () => {
    offer.status = "accepted";
    const res = await answer("accept");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("You already answered this offer. Refresh the page.");
    expect(writes()).toEqual([]);
  });

  it.each([
    ["vacancy closed", () => { vacancyLocked.status = "closed"; }],
    ["endorsement full", () => { committed = 1; }],
    ["applied elsewhere (BR-17)", () => { blocking = { application_id: NEW_APP }; }],
    ["failed company (BR-19)", () => { atFailed = true; }],
    ["already applied there", () => { applied = true; }],
    ["prescreen fails now", () => { vacancyForApply.minAge = 40; }],
    ["threshold raised", () => { vacancyForApply.matchingThreshold = 99.5; }],
    ["passing score raised", () => { offer.passingScore = 95; }],
    ["pool entry replaced", () => { offer.poolActive = false; }],
  ])("re-check fails (%s) → offer expired (committed), neutral notice, 409; no application", async (_label, arrange) => {
    arrange();
    const res = await answer("accept");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This job is no longer available. You can apply to other jobs.");
    expect(txSql("update public.pool_invitation").map((c) => c.params)).toEqual([[OFFER_ID, "pending", "expired", null]]);
    expect(txSql("update public.talent_pool set availability = $2").map((c) => c.params)).toEqual([[POOL_ID, "available"]]);
    const [note] = notices();
    expect(note.params.slice(0, 4)).toEqual([USER_ID, null, "rematch_offer_expired", "Job no longer available: ZZ Best"]);
    expect(note.params[4]).not.toMatch(/ZZ Co|company|score/i);
    expect(txSql("insert into public.application ")).toEqual([]);
    expect(txSql("insert into public.final_evaluation")).toEqual([]);
  });

  it("an expired offer → 409 'no longer available', nothing written", async () => {
    offer.status = "expired";
    const res = await answer("accept");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This job is no longer available.");
    expect(writes()).toEqual([]);
  });

  it("decline → declined, pool available again, staff notice; no application", async () => {
    const res = await answer("decline");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ offerId: OFFER_ID, status: "declined" });
    expect(txSql("update public.pool_invitation").map((c) => c.params)).toEqual([[OFFER_ID, "pending", "declined", null]]);
    expect(txSql("update public.talent_pool set availability = $2").map((c) => c.params)).toEqual([[POOL_ID, "available"]]);
    const [staff] = staffNotices();
    expect(staff.params.slice(3, 5)).toEqual(["hr_rematch_declined", "Rematch declined: Juan Dela Cruz"]);
    expect(txSql("insert into public.application ")).toEqual([]);
    expect(lockSequence()).toEqual(["job_vacancy", "applicant"]);
  });

  it("someone else's offer → 404; unknown offer → 404; bad id → 400", async () => {
    offer.userId = "someone-else";
    expect((await answer("accept")).status).toBe(404);
    offer = null;
    expect((await answer("decline")).status).toBe(404);
    expect((await call("post", "/api/applicant/offers/nope/accept").send({})).status).toBe(400);
    expect(withTransaction.mock.calls).toEqual([]);
  });

  it.each([
    ["application_one_ongoing_per_applicant", "You already have an ongoing application. Refresh the page."],
    ["application_applicant_id_job_vacancy_id_key", "You already applied for this job."],
  ])("23505 %s → 409", async (constraint, message) => {
    duplicate = { on: "application", constraint };
    const res = await answer("accept");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(message);
  });

  it("stored final ≠ JS final (FIN-01 checked twice) → 500", async () => {
    storedFinalDelta = 0.01;
    expect((await answer("accept")).status).toBe(500);
  });

  it("staff cannot answer an offer (403)", async () => {
    role = "hr";
    expect((await answer("accept")).status).toBe(403);
  });
});

// ---------------------------------------------------------------- reads

describe("GET /api/applicant/offers and GET /api/admin/pool", () => {
  it("applicant offers: job title, location, type, deadline only (no company, no score)", async () => {
    role = "applicant";
    const res = await call("get", "/api/applicant/offers");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(["deploymentLocation", "dueAt", "employmentType", "jobTitle", "offerId", "offeredAt"]);
    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes('pi.invited_at as "offeredAt"'));
    expect(sql).not.toMatch(/company|score|matching/i);
    expect(params).toEqual([USER_ID, "pending"]);
  });

  it("pool view (HR): free applicants only (no ongoing or hired application)", async () => {
    const res = await call("get", "/api/admin/pool");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ talentPoolId: POOL_ID, applicantName: "Juan Dela Cruz", offerStatus: "pending", offerCompanyName: "ZZ Co" }]);
    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes("left join lateral"));
    expect(sql).toContain("where tp.removed_at is null");
    expect(params).toEqual([BLOCKS_APPLYING_STATUSES]);
  });

  it("roles: applicant → 403 on the pool; staff → 403 on offers", async () => {
    role = "applicant";
    expect((await call("get", "/api/admin/pool")).status).toBe(403);
    role = "hr";
    expect((await call("get", "/api/applicant/offers")).status).toBe(403);
  });
});
