// Evaluation and scores (S14; PRD FR-INT-06, FR-INT-08, FR-END-02, BR-21; TC-48, TC-49, TC-51, TC-78, TC-84):
// evaluate after a confirmed interview has started, reuse earlier ratings after verification, did_not_pass → pool,
// lock order, the evaluate/no-show race in both orders, double submits, and the unique-constraint fallback.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { COMPETENCY_SECTIONS } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const APP_ID = "77777777-7777-4777-8777-777777777777";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const APPLICANT_USER = "88888888-8888-4888-8888-888888888888";
const INTERVIEW_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_APP = "44444444-4444-4444-8444-444444444444"; // the original (Cashier) interview
const NEXT_APP = "99999999-9999-4999-8999-999999999999";

const HOUR = 60 * 60 * 1000;
const inHours = (h) => new Date(Date.now() + h * HOUR).toISOString();

// The 15 active items as listRubric reads them; ids are uuids so the POST body passes zod.
let n = 0;
const RUBRIC_ROWS = COMPETENCY_SECTIONS.flatMap((s) =>
  s.items.map((name) => ({
    sectionCode: s.code,
    sectionName: s.name,
    competencyId: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    competencyName: name,
  })),
);
// ALGORITHM.md §6 worked example: A = 5, 4, 4 · B = 4, 4, 4, 4, 5, 4, 3, 4, 4 · C = 4, 4, 4
const WORKED = [5, 4, 4, 4, 4, 4, 4, 5, 4, 3, 4, 4, 4, 4, 4];
const workedRatings = () => RUBRIC_ROWS.map((r, i) => ({ competencyId: r.competencyId, rating: WORKED[i] }));

let role;
let appRow;
let lockedApp;
let attempt;
let weights;
let resume;
let documents;
let requests;
let reuse;
let storedRatings; // competency_rating rows per application id
let stored; // final_evaluation row (pg strings), null until inserted
let duplicate;
let tamperFinal;
let failOn;
let lockedRead; // fields that differ in the re-read under the locks (default: none)
let txCalls;

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const evaluate = (ratings = workedRatings()) => call("post", `/api/admin/applications/${APP_ID}/evaluation`).send({ ratings });
const reuseCall = () => call("post", `/api/admin/applications/${APP_ID}/evaluation/reuse`);
const noShow = () => call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`);

const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const appMoves = () => txSql("update public.application set status = $3");
const attemptMoves = () => txSql("update public.interview_schedule set status = $3");
const ratingInserts = () => txSql("insert into public.competency_rating");
const evaluationInserts = () => txSql("insert into public.final_evaluation");
const poolWrites = () => txCalls.filter((c) => c.sql.includes("public.talent_pool"));
const notifications = () => txSql("insert into public.notification");
const writes = () => txCalls.filter((c) => /^(insert|update)/.test(c.sql));
// Which table each "for update" locks, in order (the main FROM is the last one: lockVacancy has a subquery first).
const lockSequence = () =>
  txCalls.filter((c) => c.sql.endsWith("for update")).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);

/** What the generated columns compute (SQL semantics: numeric round half away from zero on 2-dp inputs). */
function generated(matching, interview, passing) {
  const finalH = Math.round((Math.round(Number(matching) * 100) + Math.round(Number(interview) * 100)) / 2);
  const i = Number(interview);
  return {
    final_score: (finalH / 100).toFixed(2),
    passed: finalH >= Math.round(Number(passing) * 100),
    overall_rating: i >= 80 ? 5 : i >= 60 ? 4 : i >= 40 ? 3 : i >= 20 ? 2 : 1,
  };
}

/** A confirmed attempt for APP_ID whose start time is `startsIn` hours away (negative = started). */
function confirmedInterview(startsIn = -1) {
  attempt = { interviewId: INTERVIEW_ID, applicationId: APP_ID, status: "confirmed", scheduledAt: inHours(startsIn), confirmDueAt: inHours(-2) };
  lockedApp.status = "interview_confirmed";
  appRow.status = "interview_confirmed";
}

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  appRow = {
    applicationId: APP_ID,
    applicantId: APPLICANT_ID,
    vacancyId: VACANCY_ID,
    applicantType: "experienced",
    status: "interview_confirmed",
    applicantName: "Ana Cruz",
    userId: APPLICANT_USER,
    jobTitle: "Cashier",
    companyName: "Kabayan Mart",
    passingScore: "75.00", // pg numeric → string
    matchingScore: "79.31",
  };
  lockedApp = { applicationId: APP_ID, applicantId: APPLICANT_ID, vacancyId: VACANCY_ID, applicantType: "experienced", status: "interview_confirmed" };
  attempt = null;
  weights = [
    { sectionCode: "A", sectionName: "A", weight: 30, items: [] },
    { sectionCode: "B", sectionName: "B", weight: 30, items: [] },
    { sectionCode: "C", sectionName: "C", weight: 40, items: [] },
  ];
  resume = { resumeId: "r1", fileName: "Ana.pdf", verificationStatus: "verified" };
  documents = [{ documentId: "d1", documentType: "nbi_clearance", verificationStatus: "verified" }];
  requests = [];
  reuse = [];
  storedRatings = {};
  stored = null;
  duplicate = null;
  tamperFinal = false;
  failOn = null;
  lockedRead = {};
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

  const latestAttempt = () =>
    attempt
      ? [{ interviewId: attempt.interviewId, status: attempt.status, scheduledAt: attempt.scheduledAt, started: new Date(attempt.scheduledAt) <= new Date() }]
      : [];
  const ratingsOf = (params) => (storedRatings[params[0]] ?? []).map((r) => ({ ...r, rating: String(r.rating) }));
  const findInterviewRow = () =>
    attempt
      ? [{ ...attempt, vacancyId: VACANCY_ID, applicantId: APPLICANT_ID, userId: APPLICANT_USER, applicantName: "Ana Cruz", jobTitle: "Cashier" }]
      : [];

  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes('v.passing_score as "passingScore"')) return { rows: appRow ? [{ ...appRow }] : [] };
    if (sql.includes("join public.competency c on c.section_id")) return { rows: RUBRIC_ROWS };
    if (sql.includes("left join public.job_section_weight")) return { rows: weights };
    if (sql.includes('as "started"')) return { rows: latestAttempt() };
    if (sql.includes('as "sourceJobTitle"')) {
      return { rows: stored ? [{ ...stored, sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart", sourceRatedAt: "2026-10-09T01:00:00Z" }] : [] };
    }
    if (sql.includes("from public.competency_rating")) return { rows: ratingsOf(params) };
    // S13 no-show path (findInterview, findApplicationForHr for the drop)
    if (sql.includes("where s.interview_schedule_id = $1")) return { rows: findInterviewRow() };
    if (sql.includes("join public.v_applicant_profile p")) return { rows: [{ ...appRow, status: lockedApp.status }] };
    return { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (failOn && sql.includes(failOn.sql)) throw failOn.error;
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: [{ status: "open" }] };
    if (sql.includes("from public.applicant where applicant_id = $1 for update")) return { rows: [] };
    if (sql.includes("from public.application where application_id = $1 for update")) return { rows: lockedApp ? [{ ...lockedApp }] : [] };
    if (sql.includes('v.passing_score as "passingScore"')) return { rows: [{ ...appRow, ...lockedRead }] }; // re-read under the locks
    if (sql.includes('as "started"')) return { rows: latestAttempt() };
    if (sql.includes("where s.interview_schedule_id = $1")) return { rows: findInterviewRow() };
    if (sql.includes('as "newUpload"')) return { rows: documents };
    if (sql.includes("from public.resume") && sql.includes("original_filename")) return { rows: resume ? [resume] : [] };
    if (sql.includes("from public.document_request\n")) return { rows: requests };
    if (sql.includes("with latest as")) return { rows: reuse };
    if (sql.includes("from public.competency_rating")) return { rows: ratingsOf(params) };
    if (sql.includes("insert into public.competency_rating")) {
      if (duplicate === "competency_rating_application_id_competency_id_key") {
        throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      }
      storedRatings[params[0]] = params[4].map((competencyId, i) => ({ competencyId, rating: params[5][i] }));
      return { rows: [], rowCount: params[4].length };
    }
    if (sql.includes("insert into public.final_evaluation")) {
      if (duplicate && duplicate !== "competency_rating_application_id_competency_id_key") {
        throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      }
      const [applicationId, matching, interview, passing, sections, source] = params;
      const g = generated(matching, interview, passing);
      if (tamperFinal) g.final_score = "1.00";
      stored = {
        matchingScore: Number(matching).toFixed(2),
        interviewScore: Number(interview).toFixed(2),
        finalScore: g.final_score,
        passingScore: Number(passing).toFixed(2),
        passed: g.passed,
        overallRating: g.overall_rating,
        sectionScores: JSON.parse(sections),
        sourceApplicationId: source,
        computedAt: "2026-10-10T05:00:00Z",
        applicationId,
      };
      return { rows: [{ ...stored }] };
    }
    // setInterviewStatus: stale-read safe, like the real UPDATE ... where status = $2
    if (sql.includes("confirmed_at = case when")) {
      if (!attempt || attempt.status !== params[1]) return { rows: [], rowCount: 0 };
      attempt.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    // statusMachine.transition: update ... where status = $2
    if (sql.includes("update public.application") && sql.includes("set status = $3") && params[0] === APP_ID) {
      if (lockedApp.status !== params[1]) return { rows: [], rowCount: 0 };
      lockedApp.status = params[2];
      return { rows: [], rowCount: 1 };
    }
    // the drop's shortlist refresh (no-show path)
    if (sql.includes("shortlist_per_group") && sql.includes("for update")) return { rows: [{ quota: 2, jobTitle: "Cashier" }] };
    if (sql.includes('as "occupied"')) return { rows: [{ occupied: 1 }] };
    if (sql.includes("join public.matching_result")) {
      return { rows: [{ applicationId: NEXT_APP, status: "waiting_pool", matchingScore: 70, appliedAt: "2026-10-08T02:00:00Z", userId: "u-next" }] };
    }
    if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    return { rows: [], rowCount: 1 };
  });
});

// ---------------------------------------------------------------- roles and validation

describe("roles and validation", () => {
  it("TC-10: applicants cannot use the evaluation routes", async () => {
    role = "applicant";
    expect((await call("get", `/api/admin/applications/${APP_ID}/evaluation`)).status).toBe(403);
    expect((await evaluate()).status).toBe(403);
    expect((await reuseCall()).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("TC-49: one item unrated → 400, nothing written (no transaction at all)", async () => {
    confirmedInterview();
    const res = await evaluate(workedRatings().slice(1));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(withTransaction).not.toHaveBeenCalled();
    expect(txCalls).toEqual([]);
  });

  it("a rating outside 1–5, a decimal, or an item twice → 400, nothing written", async () => {
    confirmedInterview();
    const bad = (i, rating) => workedRatings().map((r, j) => (j === i ? { ...r, rating } : r));
    expect((await evaluate(bad(0, 6))).status).toBe(400);
    expect((await evaluate(bad(0, 0))).status).toBe(400);
    expect((await evaluate(bad(0, 3.5))).status).toBe(400);
    const twice = workedRatings();
    twice[1] = { ...twice[0] };
    expect((await evaluate(twice)).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("15 ratings but one is not an active item → 422, nothing written", async () => {
    confirmedInterview();
    const ratings = workedRatings();
    ratings[14] = { competencyId: "12345678-1234-4234-8234-123456789012", rating: 4 };
    const res = await evaluate(ratings);
    expect(res.status).toBe(422);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("scores in the body are ignored: the server recomputes from the ratings", async () => {
    confirmedInterview();
    const res = await call("post", `/api/admin/applications/${APP_ID}/evaluation`).send({ ratings: workedRatings(), interviewScore: 100, finalScore: 100 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ interviewScore: 77.5, finalScore: 78.41 });
    expect(evaluationInserts()[0].params[2]).toBe(77.5);
  });

  it("unknown application → 404", async () => {
    appRow = null;
    expect((await evaluate()).status).toBe(404);
    expect((await reuseCall()).status).toBe(404);
    expect((await call("get", `/api/admin/applications/${APP_ID}/evaluation`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------- evaluate

describe("POST /api/admin/applications/:id/evaluation (FR-INT-06; TC-48, TC-51)", () => {
  it("TC-48: worked example → 83.33 / 75 / 75, interview 77.50, rating 4, final 78.41, passed; attempt completed", async () => {
    confirmedInterview();
    const res = await evaluate();
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      applicationId: APP_ID,
      status: "passed",
      sectionScores: { A: 83.33, B: 75, C: 75 },
      interviewScore: 77.5,
      overallRating: 4,
      matchingScore: 79.31,
      finalScore: 78.41,
      passingScore: 75,
      passed: true,
      ratingsSourceApplicationId: APP_ID,
      reused: false,
      interviewId: INTERVIEW_ID,
      interviewStatus: "completed",
    });

    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "applicant", "application"]); // DATABASE_SCHEMA §8

    // the attempt is read again after the application lock
    const lockAt = txCalls.findIndex((c) => c.sql.includes("from public.application where application_id = $1 for update"));
    const reReadAt = txCalls.findIndex((c) => c.sql.includes('as "started"'));
    expect(reReadAt).toBeGreaterThan(lockAt);

    // one statement for the 15 ratings, typed arrays
    const [ratings] = ratingInserts();
    expect(ratingInserts()).toHaveLength(1);
    expect(ratings.sql).toContain("select $1::uuid, $2::uuid, r.competency_id, $3::uuid, r.rating, $4::uuid");
    expect(ratings.sql).toContain("from unnest($5::uuid[], $6::smallint[]) as r (competency_id, rating)");
    expect(ratings.params.slice(0, 4)).toEqual([APP_ID, APPLICANT_ID, INTERVIEW_ID, USER_ID]);
    expect(ratings.params[4]).toEqual(RUBRIC_ROWS.map((r) => r.competencyId));
    expect(ratings.params[5]).toEqual(WORKED);

    const [insert] = evaluationInserts();
    expect(insert.sql).toContain("values ($1::uuid, $2::numeric, $3::numeric, $4::numeric, $5::jsonb, $6::uuid, $7::uuid)");
    expect(insert.params).toEqual([APP_ID, 79.31, 77.5, 75, JSON.stringify({ A: 83.33, B: 75, C: 75 }), APP_ID, USER_ID]);

    expect(attemptMoves()[0].params).toEqual([INTERVIEW_ID, "confirmed", "completed"]);
    expect(appMoves()[0].params).toEqual([APP_ID, "interview_confirmed", "passed", "Interview evaluated"]);
    expect(poolWrites()).toEqual([]);
    expect(notifications()).toEqual([]); // passed: no notice until S15 Notify
  });

  it("first-time applicant with matching 87.50 → final 82.50 (applicant type only changes matching)", async () => {
    confirmedInterview();
    appRow.matchingScore = "87.50";
    appRow.applicantType = "first_time";
    expect((await evaluate()).body.data).toMatchObject({ interviewScore: 77.5, finalScore: 82.5, passed: true });
  });

  it("TC-51: final below the passing score → did_not_pass, applicant pool (old entry closed first), neutral notice", async () => {
    confirmedInterview();
    appRow.passingScore = "80.00";
    const res = await evaluate();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: "did_not_pass", finalScore: 78.41, passed: false });
    expect(appMoves()[0].params.slice(1, 3)).toEqual(["interview_confirmed", "did_not_pass"]);

    const [close, insert] = poolWrites();
    expect(close.sql).toBe("update public.talent_pool set removed_at = now() where applicant_id = $1::uuid and removed_at is null");
    expect(close.params).toEqual([APPLICANT_ID]);
    expect(insert.sql).toContain("values ($1::uuid, $2::uuid, $3::public.pool_reason)");
    expect(insert.params).toEqual([APPLICANT_ID, APP_ID, "did_not_pass"]);
    // pool written while the applicant row is locked (lock taken before)
    expect(lockSequence()).toEqual(["job_vacancy", "applicant", "application"]);

    const [note] = notifications();
    expect(note.params.slice(0, 3)).toEqual([APPLICANT_USER, APP_ID, "evaluation_did_not_pass"]);
    expect(note.params[3]).toBe("Application update: Cashier");
    expect(`${note.params[3]} ${note.params[4]}`).not.toMatch(/kabayan|company|score|78\.41|passing|selected|interview/i);
    expect(note.params[4]).toContain("You can apply to other jobs.");
    expect(attemptMoves()[0].params).toEqual([INTERVIEW_ID, "confirmed", "completed"]);
  });

  it("before the interview start time → 409 'The interview has not started yet.', nothing written", async () => {
    confirmedInterview(1);
    const res = await evaluate();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("The interview has not started yet.");
    expect(writes()).toEqual([]);
  });

  it("an unconfirmed interview (interview_scheduled) → 409, nothing written", async () => {
    confirmedInterview();
    attempt.status = "pending_confirmation";
    lockedApp.status = "interview_scheduled";
    expect((await evaluate()).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("evaluate twice → the second gets 409 (status re-checked under the lock) and writes nothing", async () => {
    confirmedInterview();
    expect((await evaluate()).status).toBe(201);
    const before = writes().length;
    const second = await evaluate();
    expect(second.status).toBe(409);
    expect(writes().length).toBe(before);
    expect(evaluationInserts()).toHaveLength(1);
  });

  it.each([["final_evaluation_application_id_key"], ["competency_rating_application_id_competency_id_key"]])(
    "23505 on %s (a double submit past the re-check) → 409",
    async (constraint) => {
      confirmedInterview();
      duplicate = constraint;
      const res = await evaluate();
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("This application was already evaluated. Refresh the page.");
    },
  );

  it("23505 on any other constraint, or any other error → 500 (not hidden as 409)", async () => {
    confirmedInterview();
    appRow.passingScore = "80.00"; // did_not_pass → pool insert
    failOn = { sql: "insert into public.talent_pool", error: Object.assign(new Error("dup"), { code: "23505", constraint: "talent_pool_one_active_entry" }) };
    expect((await evaluate()).status).toBe(500);
    confirmedInterview();
    stored = null;
    failOn = { sql: "insert into public.final_evaluation", error: Object.assign(new Error("boom"), { code: "57014" }) };
    expect((await evaluate()).status).toBe(500);
  });

  it("stored generated columns differ from the JS result → 500 (FIN-01 enforced twice; the transaction rolls back)", async () => {
    confirmedInterview();
    tamperFinal = true;
    expect((await evaluate()).status).toBe(500);
    // the error leaves the transaction callback, so withTransaction rolls back: nothing is committed
    await expect(withTransaction.mock.results[0].value).rejects.toThrow(/Stored final score differs/);
    expect(appMoves()).toEqual([]);
    expect(attemptMoves()).toEqual([]);
    expect(poolWrites()).toEqual([]);
    expect(notifications()).toEqual([]);
  });

  it("stores the matching and passing scores read under the locks, not the pre-lock read", async () => {
    confirmedInterview();
    lockedRead = { passingScore: "80.00" }; // pre-lock read said 75.00
    const res = await evaluate();
    expect(res.body.data).toMatchObject({ passingScore: 80, finalScore: 78.41, passed: false, status: "did_not_pass" });
    expect(evaluationInserts()[0].params[3]).toBe(80);
    const lockAt = txCalls.findIndex((c) => c.sql.includes("from public.application where application_id = $1 for update"));
    const reReadAt = txCalls.findIndex((c) => c.sql.includes('v.passing_score as "passingScore"'));
    expect(reReadAt).toBeGreaterThan(lockAt);
  });
});

describe("evaluate vs no-show race: both re-check under the application lock, the second one gets 409", () => {
  it("no-show first, then evaluate → 409 (application dropped)", async () => {
    confirmedInterview();
    const drop = await noShow();
    expect(drop.status).toBe(200);
    expect(drop.body.data).toMatchObject({ interviewStatus: "no_show", status: "dropped" });
    txCalls = [];
    const res = await evaluate();
    expect(res.status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("evaluate first, then no-show → 409 (attempt completed, no longer open)", async () => {
    confirmedInterview();
    expect((await evaluate()).status).toBe(201);
    expect(attempt.status).toBe("completed");
    txCalls = [];
    const res = await noShow();
    expect(res.status).toBe(409);
    expect(appMoves()).toEqual([]);
    expect(lockedApp.status).toBe("passed");
  });
});

// ---------------------------------------------------------------- reuse

describe("POST /api/admin/applications/:id/evaluation/reuse (FR-INT-08, BR-21, WSM-03; TC-78, TC-84)", () => {
  // Store Crew (ClayGo): A 20 / B 80 / C 0, passing 75, fresh matching 80.00 (ALGORITHM.md §6).
  function storeCrewApplication() {
    appRow = { ...appRow, status: "shortlisted", jobTitle: "Store Crew", companyName: "ClayGo", matchingScore: "80.00", passingScore: "75.00" };
    lockedApp.status = "shortlisted";
    weights = [
      { sectionCode: "A", weight: 20 },
      { sectionCode: "B", weight: 80 },
      { sectionCode: "C", weight: 0 },
    ];
    reuse = [{ sourceApplicationId: SOURCE_APP, jobTitle: "Cashier", companyName: "Kabayan Mart", ratedAt: "2026-10-09T01:00:00Z" }];
    storedRatings[SOURCE_APP] = workedRatings();
  }

  it("TC-78: the original 15 ratings × Store Crew weights → 76.67, final 78.34, passed; no interview, no rating rows", async () => {
    storeCrewApplication();
    const res = await reuseCall();
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      applicationId: APP_ID,
      status: "passed",
      sectionScores: { A: 83.33, B: 75, C: 75 },
      interviewScore: 76.67,
      overallRating: 4,
      matchingScore: 80,
      finalScore: 78.34,
      passingScore: 75,
      passed: true,
      ratingsSourceApplicationId: SOURCE_APP,
      reused: true,
    });
    expect(lockSequence()).toEqual(["job_vacancy", "applicant", "application"]);
    expect(evaluationInserts()[0].params).toEqual([APP_ID, 80, 76.67, 75, JSON.stringify({ A: 83.33, B: 75, C: 75 }), SOURCE_APP, USER_ID]);
    expect(ratingInserts()).toEqual([]);
    expect(attemptMoves()).toEqual([]);
    expect(appMoves()[0].params).toEqual([APP_ID, "shortlisted", "passed", "Reused ratings (BR-21)"]);
    // the source lookup and the verification re-check run on the transaction client, after the application lock
    const lockAt = txCalls.findIndex((c) => c.sql.includes("from public.application where application_id = $1 for update"));
    const lookupAt = txCalls.findIndex((c) => c.sql.includes("with latest as"));
    expect(lookupAt).toBeGreaterThan(lockAt);
    expect(txCalls[lookupAt].params).toEqual([APPLICANT_ID, APP_ID]);
    expect(txSql("from public.competency_rating")[0].params).toEqual([SOURCE_APP]);
  });

  it("TC-84: a third application resolves to the original interview, not the latest (reused) evaluation", async () => {
    storeCrewApplication();
    // The lookup (domain/reuse.js) follows the latest evaluation's ratings_source_application_id: the Store Crew
    // reuse points at the Cashier interview, so the source is the Cashier application again.
    appRow = { ...appRow, jobTitle: "Third Job", matchingScore: "70.00" };
    weights = [
      { sectionCode: "A", weight: 40 },
      { sectionCode: "B", weight: 40 },
      { sectionCode: "C", weight: 20 },
    ];
    const res = await reuseCall();
    expect(res.status).toBe(201);
    expect(res.body.data.ratingsSourceApplicationId).toBe(SOURCE_APP);
    expect(evaluationInserts()[0].params[5]).toBe(SOURCE_APP);
    // (4000 × 8333 + 4000 × 7500 + 2000 × 7500) / 10000 = 7833.2 → 78.33; final (7000 + 7833) / 2 = 7416.5 → 74.17
    expect(res.body.data).toMatchObject({ interviewScore: 78.33, finalScore: 74.17, passed: false, status: "did_not_pass" });
  });

  it("reuse that does not pass → did_not_pass, pool, neutral notice", async () => {
    storeCrewApplication();
    appRow.passingScore = "79.00";
    const res = await reuseCall();
    expect(res.body.data).toMatchObject({ status: "did_not_pass", finalScore: 78.34, passed: false });
    expect(poolWrites().map((c) => c.params)).toEqual([[APPLICANT_ID], [APPLICANT_ID, APP_ID, "did_not_pass"]]);
    expect(notifications()[0].params[2]).toBe("evaluation_did_not_pass");
  });

  it("no earlier evaluation → 422, nothing written", async () => {
    storeCrewApplication();
    reuse = [];
    const res = await reuseCall();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("This applicant has no earlier evaluation. Schedule an interview instead.");
    expect(writes()).toEqual([]);
  });

  it("not fully verified (resume pending, or a request pending) → 422, nothing written", async () => {
    storeCrewApplication();
    resume = { ...resume, verificationStatus: "pending" };
    expect((await reuseCall()).status).toBe(422);
    resume = { ...resume, verificationStatus: "verified" };
    requests = [{ requestId: "q1", status: "pending" }];
    expect((await reuseCall()).status).toBe(422);
    expect(writes()).toEqual([]);
  });

  it("the source does not have all 15 ratings → 422", async () => {
    storeCrewApplication();
    storedRatings[SOURCE_APP] = workedRatings().slice(1);
    const res = await reuseCall();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/earlier evaluation does not have all/);
    expect(writes()).toEqual([]);
  });

  it("not shortlisted → 409", async () => {
    storeCrewApplication();
    lockedApp.status = "waiting_pool";
    expect((await reuseCall()).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("reuse twice → the second gets 409 and writes nothing", async () => {
    storeCrewApplication();
    expect((await reuseCall()).status).toBe(201);
    const before = writes().length;
    expect((await reuseCall()).status).toBe(409);
    expect(writes().length).toBe(before);
    expect(evaluationInserts()).toHaveLength(1);
  });

  it("23505 on final_evaluation_application_id_key → 409; another constraint → 500", async () => {
    storeCrewApplication();
    duplicate = "final_evaluation_application_id_key";
    expect((await reuseCall()).status).toBe(409);
    duplicate = "some_other_key";
    expect((await reuseCall()).status).toBe(500);
  });
});

// ---------------------------------------------------------------- read

describe("GET /api/admin/applications/:id/evaluation (evaluation page)", () => {
  it("confirmed and started → canEvaluate, the 15 items grouped A/B/C with the section weights", async () => {
    confirmedInterview();
    const res = await call("get", `/api/admin/applications/${APP_ID}/evaluation`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.canEvaluate).toBe(true);
    expect(data.blockedReason).toBeNull();
    expect(data.application).toMatchObject({ matchingScore: 79.31, passingScore: 75, applicantName: "Ana Cruz" });
    expect(data.sections.map((s) => [s.sectionCode, s.weight, s.items.length])).toEqual([["A", 30, 3], ["B", 30, 9], ["C", 40, 3]]);
    expect(data.interview).toMatchObject({ interviewId: INTERVIEW_ID, status: "confirmed", started: true });
    expect(data.evaluation).toBeNull();
  });

  it("before the start time → blocked with the reason", async () => {
    confirmedInterview(2);
    const data = (await call("get", `/api/admin/applications/${APP_ID}/evaluation`)).body.data;
    expect(data.canEvaluate).toBe(false);
    expect(data.blockedReason).toBe("The interview has not started yet.");
  });

  it("a reused evaluation shows the original interview's ratings read-only, with numbers (not pg strings)", async () => {
    appRow.status = "passed";
    storedRatings[SOURCE_APP] = workedRatings();
    stored = {
      matchingScore: "80.00",
      interviewScore: "76.67",
      finalScore: "78.34",
      passingScore: "75.00",
      passed: true,
      overallRating: 4,
      sectionScores: { A: 83.33, B: 75, C: 75 },
      sourceApplicationId: SOURCE_APP,
      computedAt: "2026-10-10T05:00:00Z",
    };
    const data = (await call("get", `/api/admin/applications/${APP_ID}/evaluation`)).body.data;
    expect(data.canEvaluate).toBe(false);
    expect(data.blockedReason).toBe("This application already has an evaluation.");
    expect(data.evaluation).toMatchObject({
      reused: true,
      interviewScore: 76.67,
      finalScore: 78.34,
      matchingScore: 80,
      passingScore: 75,
      overallRating: 4,
      source: { applicationId: SOURCE_APP, jobTitle: "Cashier", companyName: "Kabayan Mart" },
    });
    expect(data.evaluation.ratings).toEqual(workedRatings());
  });
});
