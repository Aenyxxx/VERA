// Apply flow (PRD FR-APP-01..07, FR-VAC-07, BR-01/04/05/14; TC-10, TC-27, TC-30..34) and the status panel list.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/svcClient.js", () => ({ matchResume: vi.fn() }));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { matchResume } = await import("../src/lib/svcClient.js");
const { svcUnavailable } = await import("../src/lib/errors.js");
const { app } = await import("../src/app.js");
const { applyLimitStore } = await import("../src/modules/applications/applications.routes.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const RESUME_ID = "33333333-3333-4333-8333-333333333333";
const NEW_APP = "44444444-4444-4444-8444-444444444444";

const SECTIONS = { skills: "Cash handling\nPOS terminal\nCustomer service", experience: "Cashier, ABC Store\n2024-2025" };

// docs/test-cases.md standard data: Cashier (slots 2 → shortlist 4 per group, cap 16, threshold 40, age 18–35)
const CASHIER = {
  jobTitle: "Cashier",
  status: "open",
  requiredSkills: "Cash handling\nPOS system operation\nCustomer service\nIssuing receipts",
  experienceRequirement: "Cashier\nProcess cash and cashless payments\nBalance the cash drawer",
  minYearsExperience: 1,
  minAge: 18,
  maxAge: 35,
  genderRequirement: "any",
  minEducationLevel: "senior_high",
  minHeightCm: null,
  matchingThreshold: 40,
};

const MATCH = {
  matchScore: 79.31,
  scores: { skills: 87.5, experience: 71.11 },
  yearsWorked: 0.5,
  matchedSkills: ["Cash handling", "POS system operation", "Customer service", "Issuing receipts"],
  missingSkills: [],
  skillMatches: [{ requirement: "Cash handling", evidence: "Cash handling", similarity: 0.92, credit: 1 }],
  experienceMatches: [],
  warnings: [],
  modelName: "all-MiniLM-L6-v2",
};

let role;
let applicantRow;
let vacancyRow;
let applied;
let locked;
let candidates;
let poolSql;
let txCalls;
let blocking; // ongoing or hired application of this applicant (BR-17)
let companyBlocked; // failed application at this vacancy's company (BR-19)
let blockingInTx; // what the re-check under the applicant lock sees (another tab may have applied meanwhile)

const body = (overrides = {}) => ({ vacancyId: VACANCY_ID, applicantType: "experienced", ...overrides });
const post = (payload = body()) =>
  request(app).post("/api/applicant/applications").set("Authorization", "Bearer t").send(payload);
const txSql = (start) => txCalls.filter((c) => c.sql.startsWith(start));

beforeEach(() => {
  vi.clearAllMocks();
  applyLimitStore.resetAll();
  role = "applicant";
  applicantRow = {
    applicantId: APPLICANT_ID,
    age: 24,
    gender: "female",
    educationLevel: "college_graduate",
    heightCm: 158,
    resumeId: RESUME_ID,
    sections: SECTIONS,
  };
  vacancyRow = { ...CASHIER };
  applied = false;
  locked = { status: "open", slotsNeeded: 2, applicationCap: 16, applicationCount: 3 };
  candidates = () => [
    { applicationId: NEW_APP, status: "waiting_pool", matchingScore: 79.31, appliedAt: "2026-10-10T08:00:00Z", userId: USER_ID },
  ];
  poolSql = [];
  txCalls = [];
  blocking = null;
  companyBlocked = false;
  blockingInTx = undefined;

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  matchResume.mockResolvedValue(MATCH);
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("from public.v_applicant_profile")) return { rows: applicantRow ? [applicantRow] : [] };
    if (sql.includes("v.matching_threshold")) return { rows: vacancyRow ? [vacancyRow] : [] };
    if (sql.includes("select 1 from public.application where")) return { rows: applied ? [{}] : [] };
    if (sql.includes('as "blocked"')) return { rows: [{ blocked: companyBlocked }] };
    if (sql.includes('as "jobTitle"') && sql.includes("limit 1")) return { rows: blocking ? [blocking] : [] };
    return { rows: [] };
  });
  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: locked ? [locked] : [] };
    if (sql.includes("shortlist_per_group") && sql.includes("for update")) return { rows: [{ quota: 4, jobTitle: "Cashier" }] };
    if (sql.includes("insert into public.application ")) return { rows: [{ applicationId: NEW_APP }] };
    if (sql.includes('as "occupied"')) return { rows: [{ occupied: 0 }] };
    if (sql.includes("join public.matching_result")) return { rows: candidates() };
    if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    if (sql.includes('as "blocked"')) return { rows: [{ blocked: companyBlocked }] };
    if (sql.includes('as "jobTitle"') && sql.includes("limit 1")) {
      const seen = blockingInTx === undefined ? blocking : blockingInTx;
      return { rows: seen ? [seen] : [] };
    }
    return { rows: [], rowCount: 1 };
  });
});

describe("POST /api/applicant/applications", () => {
  it("TC-10: HR cannot apply", async () => {
    role = "hr";
    const res = await post();
    expect(res.status).toBe(403);
    expect(matchResume).not.toHaveBeenCalled();
  });

  it("TC-29 (API): the applicant type is required", async () => {
    const res = await post({ vacancyId: VACANCY_ID });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("TC-28 (API): refuses an applicant without a confirmed profile", async () => {
    applicantRow = null;
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Confirm your profile before applying.");
  });

  it.each([
    ["no current resume", { resumeId: null, sections: null }],
    ["empty extracted sections", { sections: { skills: "  ", experience: "" } }],
  ])("refuses with %s before calling the svc", async (_label, patch) => {
    Object.assign(applicantRow, patch);
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      "We could not read your resume details. Please contact Confiable Manpower so we can update your resume.",
    );
    expect(matchResume).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the vacancy is not open", async () => {
    vacancyRow.status = "closed";
    const res = await post();
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("This job is no longer open.");
  });

  it("TC-34: one application per vacancy", async () => {
    applied = true;
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "CONFLICT", message: "You already applied for this job." });
    expect(matchResume).not.toHaveBeenCalled();
  });

  it("TC-30: prescreen fails on age → prescreen_failed, no svc call, the notification names the condition", async () => {
    applicantRow.age = 40;
    const res = await post();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      applicationId: NEW_APP,
      status: "prescreen_failed",
      failedConditions: ["Age must be between 18 and 35 (you are 40)."],
    });
    expect(matchResume).not.toHaveBeenCalled();
    const [insert] = txSql("insert into public.application ");
    expect(insert.params).toEqual([APPLICANT_ID, VACANCY_ID, RESUME_ID, "experienced", "prescreen_failed", "Age must be between 18 and 35 (you are 40)."]);
    expect(txSql("insert into public.matching_result")).toHaveLength(0);
    const [notice] = txSql("insert into public.notification");
    expect(notice.params[2]).toBe("prescreen_failed");
    expect(notice.params[4]).toContain("Age must be between 18 and 35");
    expect(txSql("select shortlist_per_group")).toHaveLength(0); // no shortlist refresh
  });

  it("TC-31: matching below the threshold → below_threshold, result stored, notified, no shortlist refresh", async () => {
    matchResume.mockResolvedValue({ ...MATCH, matchScore: 21.4 });
    const res = await post();

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("below_threshold");
    expect(res.body.data).not.toHaveProperty("matchingScore");
    expect(txSql("insert into public.application ")[0].params[4]).toBe("below_threshold");
    expect(txSql("insert into public.matching_result")[0].params[1]).toBe(21.4);
    expect(txSql("insert into public.notification")[0].params[2]).toBe("below_threshold");
    expect(txSql("select shortlist_per_group")).toHaveLength(0);
  });

  it("below_threshold keeps its full matching_result row, written in the same transaction as the application", async () => {
    matchResume.mockResolvedValue({ ...MATCH, matchScore: 21.4 });
    const res = await post();

    expect(res.body.data.status).toBe("below_threshold");
    expect(withTransaction).toHaveBeenCalledTimes(1);
    const [insert] = txSql("insert into public.application ");
    const results = txSql("insert into public.matching_result");
    expect(results).toHaveLength(1);
    expect(txCalls.indexOf(results[0])).toBeGreaterThan(txCalls.indexOf(insert));
    expect(results[0].params).toEqual([
      NEW_APP,
      21.4,
      87.5,
      71.11,
      0.5,
      JSON.stringify(MATCH.matchedSkills),
      JSON.stringify([]),
      JSON.stringify(MATCH.skillMatches),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({ skills: 0.5, experience: 0.5 }),
      "all-MiniLM-L6-v2",
    ]);
    expect(pool.query.mock.calls.some(([sql]) => sql.includes("insert into public.matching_result"))).toBe(false);
  });

  it.each([
    ["waiting_pool", 79.31, 1],
    ["below_threshold", 21.4, 1],
  ])("%s → exactly one matching_result row", async (status, matchScore, rows) => {
    candidates = () => [];
    matchResume.mockResolvedValue({ ...MATCH, matchScore });
    const res = await post();
    expect(res.body.data.status).toBe(status);
    expect(txSql("insert into public.matching_result")).toHaveLength(rows);
  });

  it("TC-32: Experienced → svc gets the stored sections, job fields and 0.5/0.5; waiting_pool, then shortlisted by the refresh", async () => {
    const res = await post();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ applicationId: NEW_APP, status: "shortlisted" });
    expect(matchResume).toHaveBeenCalledWith({
      sections: SECTIONS,
      job: { skills: CASHIER.requiredSkills, experience: CASHIER.experienceRequirement, minYears: 1 },
      weights: { skills: 0.5, experience: 0.5 },
    });

    const [insert] = txSql("insert into public.application ");
    expect(insert.params[4]).toBe("waiting_pool");
    const [result] = txSql("insert into public.matching_result");
    expect(result.params.slice(0, 5)).toEqual([NEW_APP, 79.31, 87.5, 71.11, 0.5]);
    expect(JSON.parse(result.params[10])).toEqual({ skills: 0.5, experience: 0.5 });
    expect(result.params[11]).toBe("all-MiniLM-L6-v2");

    // The applicant's own insert is attributed to them; the refresh moves run as the system.
    const clearIndex = txCalls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    expect(txCalls.indexOf(insert)).toBeLessThan(clearIndex);
    const [promotion] = txSql("update public.application");
    expect(promotion.params).toEqual([NEW_APP, "waiting_pool", "shortlisted", "shortlist refresh"]);
    expect(txCalls.indexOf(promotion)).toBeGreaterThan(clearIndex);
    expect(txSql("insert into public.notification").map((n) => n.params[2])).toEqual(["application_submitted", "shortlisted"]);
  });

  it("stays in the waiting pool when the refresh does not promote it", async () => {
    candidates = () => [];
    const res = await post();
    expect(res.body.data.status).toBe("waiting_pool");
    expect(res.body.data.message).toMatch(/was received/);
  });

  it("TC-33: First-time → weights skills 1 / experience 0", async () => {
    await post(body({ applicantType: "first_time" }));
    expect(matchResume.mock.calls[0][0].weights).toEqual({ skills: 1, experience: 0 });
    expect(JSON.parse(txSql("insert into public.matching_result")[0].params[10])).toEqual({ skills: 1, experience: 0 });
    expect(txSql("insert into public.application ")[0].params[3]).toBe("first_time");
  });

  describe("MAT-04 weights follow the vacancy's experience criterion", () => {
    const sentWeights = () => matchResume.mock.calls[0][0].weights;
    const storedWeights = () => JSON.parse(txSql("insert into public.matching_result")[0].params[10]);

    it("Experienced on a job with no experience criterion (blank text, 0 years) → 1/0 sent and stored", async () => {
      vacancyRow = { ...CASHIER, experienceRequirement: "   ", minYearsExperience: 0 };
      await post();
      expect(matchResume.mock.calls[0][0].job.experience).toBe("   "); // svc input unchanged
      expect(sentWeights()).toEqual({ skills: 1, experience: 0 });
      expect(storedWeights()).toEqual({ skills: 1, experience: 0 });
    });

    it("Experienced on a job with experience text keeps 0.5/0.5", async () => {
      vacancyRow = { ...CASHIER, minYearsExperience: 0 };
      await post();
      expect(sentWeights()).toEqual({ skills: 0.5, experience: 0.5 });
      expect(storedWeights()).toEqual({ skills: 0.5, experience: 0.5 });
    });

    it("Experienced on a job with min years > 0 and blank text keeps 0.5/0.5", async () => {
      vacancyRow = { ...CASHIER, experienceRequirement: null, minYearsExperience: 1 };
      await post();
      expect(sentWeights()).toEqual({ skills: 0.5, experience: 0.5 });
      expect(storedWeights()).toEqual({ skills: 0.5, experience: 0.5 });
    });

    it("First-time on a job with no experience criterion is unchanged (1/0)", async () => {
      vacancyRow = { ...CASHIER, experienceRequirement: null, minYearsExperience: 0 };
      await post(body({ applicantType: "first_time" }));
      expect(sentWeights()).toEqual({ skills: 1, experience: 0 });
      expect(storedWeights()).toEqual({ skills: 1, experience: 0 });
    });
  });

  it("rounds the score once (39.995 → 40.00), stores it, and applies the threshold to the stored value", async () => {
    matchResume.mockResolvedValue({ ...MATCH, matchScore: 39.995 });
    const res = await post();
    expect(res.body.data.status).not.toBe("below_threshold");
    expect(txSql("insert into public.matching_result")[0].params[1]).toBe(40);
  });

  it("TC-27: the application that reaches the cap closes the vacancy; the next one is refused", async () => {
    locked.applicationCount = 15; // 15 qualified of 16
    const first = await post();
    expect(first.status).toBe(201);
    const [close] = txSql("update public.job_vacancy");
    expect(close.params).toEqual([VACANCY_ID, "closed", false, true]);

    txCalls = [];
    locked = { ...locked, applicationCount: 16 };
    const next = await post();
    expect(next.status).toBe(409);
    expect(next.body.error.message).toBe("Applications for this job just closed.");
    expect(txSql("insert into")).toHaveLength(0);
  });

  it("refuses a qualified outcome when the cap filled while matching ran (re-checked under the lock)", async () => {
    locked.applicationCount = 16;
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "CONFLICT", message: "Applications for this job just closed." });
    expect(matchResume).toHaveBeenCalled(); // the match result is discarded
    expect(txSql("insert into")).toHaveLength(0);
  });

  it("refuses any outcome when the vacancy closed while matching ran", async () => {
    locked.status = "closed";
    applicantRow.age = 40; // prescreen_failed outcome
    const res = await post();
    expect(res.status).toBe(409);
    expect(txSql("insert into")).toHaveLength(0);
  });

  it("still records a rejected outcome at a full cap (it never uses up the cap)", async () => {
    locked.applicationCount = 16;
    matchResume.mockResolvedValue({ ...MATCH, matchScore: 12 });
    const res = await post();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("below_threshold");
    expect(txSql("update public.job_vacancy")).toHaveLength(0);
  });

  it("svc down → 503 and nothing is written", async () => {
    matchResume.mockRejectedValue(svcUnavailable());
    const res = await post();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SVC_UNAVAILABLE");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("two submits at the same time → the unique index answers 409", async () => {
    txClient.query.mockImplementation(async (sql) => {
      if (sql.includes("application_cap")) return { rows: [locked] };
      if (sql.includes("insert into public.application ")) throw Object.assign(new Error("duplicate"), { code: "23505" });
      return { rows: [] };
    });
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("You already applied for this job.");
  });
});

describe("one ongoing application and the company block (BR-17..BR-19)", () => {
  const ONGOING_MESSAGE = "You already have an ongoing application. You can apply to another job once it is finished.";

  it("TC-73: an ongoing application blocks applying anywhere, before prescreen or matching", async () => {
    blocking = { status: "shortlisted", jobTitle: "Store Crew" };
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "CONFLICT", message: ONGOING_MESSAGE });
    expect(matchResume).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("TC-82: hired blocks applying (until training_failed)", async () => {
    blocking = { status: "hired", jobTitle: "Store Crew" };
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("You are already hired through Confiable Manpower, so you cannot apply to another job.");
  });

  it("only ongoing and hired statuses are looked up as blocking", async () => {
    await post();
    const lookup = poolSql.find((q) => q.sql.includes('as "jobTitle"') && q.sql.includes("limit 1"));
    expect(lookup.params).toEqual([
      APPLICANT_ID,
      ["waiting_pool", "shortlisted", "interview_scheduled", "interview_confirmed", "passed",
        "passed_awaiting_confirmation", "for_endorsement", "endorsed", "hired"],
    ]);
  });

  it("TC-75: a vacancy at a failed company is refused with a generic message (no company, no reason)", async () => {
    companyBlocked = true;
    const res = await post();
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("This job is not available for your application.");
    expect(JSON.stringify(res.body)).not.toMatch(/company|kabayan|claygo|failed|rejected/i);
    expect(matchResume).not.toHaveBeenCalled();
  });

  it("TC-76: only failed outcomes block a company; prescreen_failed, below_threshold, not_selected, standby do not", async () => {
    await post();
    const check = poolSql.find((q) => q.sql.includes('as "blocked"'));
    expect(check.params).toEqual([VACANCY_ID, USER_ID, ["did_not_pass", "not_hired", "training_failed", "dropped"]]);
    for (const neutral of ["prescreen_failed", "below_threshold", "not_selected", "standby", "archived"]) {
      expect(check.params[2]).not.toContain(neutral);
    }
    expect(check.sql).not.toMatch(/public\.company\b|company_name/);
  });

  it("re-checks under the applicant lock: another tab applied while matching ran → 409, nothing written", async () => {
    blockingInTx = { status: "waiting_pool", jobTitle: "Store Crew" };
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(ONGOING_MESSAGE);
    // Lock order: job_vacancy → applicant → application (DATABASE_SCHEMA §8)
    expect(txCalls[0].sql).toMatch(/from public\.job_vacancy v where v\.job_vacancy_id = \$1 for update/);
    expect(txCalls[1].sql).toBe("select 1 from public.applicant where applicant_id = $1 for update");
    expect(txSql("insert into")).toHaveLength(0);
  });

  it("re-checks the company block under the lock too", async () => {
    // Free before matching (pool check), blocked by the time the transaction re-checks.
    const base = txClient.query.getMockImplementation();
    txClient.query.mockImplementation(async (sql, params) =>
      sql.includes('as "blocked"') ? { rows: [{ blocked: true }] } : base(sql, params),
    );
    const res = await post();
    expect(res.status).toBe(404);
    expect(txSql("insert into")).toHaveLength(0);
  });

  it("TC-83: two simultaneous applies to different jobs → the one-ongoing index answers with the ongoing message", async () => {
    txClient.query.mockImplementation(async (sql) => {
      if (sql.includes("application_cap")) return { rows: [locked] };
      if (sql.includes("insert into public.application ")) {
        throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: "application_one_ongoing_per_applicant" });
      }
      return { rows: [] };
    });
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(ONGOING_MESSAGE);
  });

  it("TC-74 / TC-77: after a neutral or failed outcome elsewhere the applicant applies again with fresh matching", async () => {
    blocking = null; // e.g. an earlier below_threshold or not_hired at another company
    const res = await post(body({ applicantType: "first_time" }));
    expect(res.status).toBe(201);
    expect(matchResume).toHaveBeenCalledTimes(1); // matched against THIS vacancy, never reused
    expect(matchResume.mock.calls[0][0].job.skills).toBe(CASHIER.requiredSkills);
    expect(txSql("insert into public.application ")[0].params[3]).toBe("first_time"); // type chosen again
  });
});

it("TRD §7.3: at most 20 applications per minute per IP", async () => {
  applied = true; // cheap 409s; the limiter runs first
  for (let i = 0; i < 20; i += 1) expect((await post()).status).toBe(409);
  const res = await post();
  expect(res.status).toBe(429);
  expect(res.body.error.code).toBe("BUSINESS_RULE");
});

describe("GET /api/applicant/applications", () => {
  it("lists the applicant's applications without company, reasons, or scores", async () => {
    const row = {
      applicationId: NEW_APP,
      vacancyId: VACANCY_ID,
      jobTitle: "Cashier",
      applicantType: "experienced",
      status: "waiting_pool",
      appliedAt: "2026-10-10T08:00:00.000Z",
      statusChangedAt: "2026-10-10T08:00:00.000Z",
      actionDueAt: null,
    };
    pool.query.mockImplementation(async (sql, params) => {
      if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
      poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return { rows: [row] };
    });

    const res = await request(app).get("/api/applicant/applications").set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([row]);
    const [{ sql, params }] = poolSql;
    expect(sql).not.toMatch(/company|status_reason|matching/i);
    expect(params).toEqual([USER_ID, "pending"]); // nextDueAt = earliest pending document request
  });

  it("TC-10: HR cannot read the applicant status panel", async () => {
    role = "hr";
    const res = await request(app).get("/api/applicant/applications").set("Authorization", "Bearer t");
    expect(res.status).toBe(403);
  });
});
