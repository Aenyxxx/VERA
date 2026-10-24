// Interview scheduling (S13; PRD FR-INT-01/02/05 simplified; TC-43): schedule from the review sheet (decision 37:
// set at once, the applicant is only notified), HR edit, Mark no-show through the S12 drop service, lock order,
// the applicant list with the final interview, reschedule requests.
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
const APP_ID = "77777777-7777-4777-8777-777777777777";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const APPLICANT_USER = "88888888-8888-4888-8888-888888888888";
const INTERVIEW_ID = "55555555-5555-4555-8555-555555555555";
const INTERVIEWER_ID = "33333333-3333-4333-8333-333333333333";
const NEXT_APP = "99999999-9999-4999-8999-999999999999";

const HOUR = 60 * 60 * 1000;
const inHours = (h) => new Date(Date.now() + h * HOUR).toISOString();

let role;
let appRow;
let lockedApp;
let attempt;
let resume;
let documents;
let requests;
let reuse;
let interviewerActive;
let duplicate;
let txCalls;
let poolSql;

const scheduleBody = (overrides = {}) => ({
  applicationId: APP_ID,
  scheduledAt: inHours(48),
  durationMinutes: 30,
  meetingLink: "https://meet.google.com/abc-defg-hij",
  interviewerId: INTERVIEWER_ID,
  ...overrides,
});

const call = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const txSql = (needle) => txCalls.filter((c) => c.sql.includes(needle));
const notifications = () => txSql("insert into public.notification");
// statusMachine.transition only (txCalls are whitespace-normalized); attempt updates are attemptMoves().
const appMoves = () => txSql("update public.application set status = $3");
const attemptMoves = () => txSql("update public.interview_schedule set status = $3");
// Which table each "for update" locks, in order (the main FROM is the last one: lockVacancy has a subquery first).
const lockSequence = () =>
  txCalls.filter((c) => c.sql.endsWith("for update")).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  appRow = {
    applicationId: APP_ID,
    applicantId: APPLICANT_ID,
    vacancyId: VACANCY_ID,
    applicantType: "experienced",
    status: "shortlisted",
    jobTitle: "Store Crew",
    companyName: "ClayGo",
    userId: APPLICANT_USER,
  };
  lockedApp = { applicationId: APP_ID, applicantId: APPLICANT_ID, vacancyId: VACANCY_ID, applicantType: "experienced", status: "shortlisted" };
  attempt = null;
  resume = { resumeId: "r1", fileName: "Ana.pdf", verificationStatus: "verified" };
  documents = [{ documentId: "d1", documentType: "diploma", verificationStatus: "verified" }];
  requests = [];
  reuse = [];
  interviewerActive = true;
  duplicate = false;
  txCalls = [];
  poolSql = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

  const interviewRow = () => (attempt ? [{ ...attempt }] : []);
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("where s.interview_schedule_id = $1")) return { rows: interviewRow() };
    if (sql.includes("join public.v_applicant_profile p")) return { rows: appRow ? [appRow] : [] };
    if (sql.includes('c.company_name as "companyName"') && sql.includes("interview_schedule")) return { rows: [{ interviewId: INTERVIEW_ID }] };
    if (sql.includes("case when s.status")) return { rows: [{ interviewId: INTERVIEW_ID, jobTitle: "Store Crew", meetingLink: null }] };
    if (sql.includes("from public.user_account")) return { rows: [{ userId: INTERVIEWER_ID, fullName: "Maria HR", role: "hr" }] };
    return { rows: [] };
  });

  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: [{ status: "open" }] };
    if (sql.includes("from public.applicant where applicant_id = $1 for update")) return { rows: [] };
    if (sql.includes("from public.application where application_id = $1 for update")) return { rows: lockedApp ? [{ ...lockedApp }] : [] };
    if (sql.includes("where s.interview_schedule_id = $1")) return { rows: interviewRow() };
    if (sql.includes('as "newUpload"')) return { rows: documents };
    if (sql.includes("join public.resume r on r.resume_id = a.resume_id")) return { rows: resume ? [resume] : [] }; // decision 16
    if (sql.includes("from public.document_request\n")) return { rows: requests };
    if (sql.includes("with latest as")) return { rows: reuse };
    if (sql.includes("select 1 from public.user_account")) return { rows: interviewerActive ? [{ "?column?": 1 }] : [] };
    if (sql.includes("from public.system_setting")) return { rows: [{ days: 3 }] };
    if (sql.includes("insert into public.interview_schedule")) {
      if (duplicate) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      return { rows: [{ interviewId: INTERVIEW_ID, status: params[8], attemptNumber: params[7], scheduledAt: params[2], confirmDueAt: params[5] }] };
    }
    if (sql.includes("set interviewer_id")) {
      return { rows: [{ interviewId: INTERVIEW_ID, status: attempt.status, scheduledAt: params[2], confirmDueAt: params[5] }] };
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
    if (sql.includes("shortlist_per_group") && sql.includes("for update")) return { rows: [{ quota: 2, jobTitle: "Store Crew" }] };
    if (sql.includes('as "occupied"')) return { rows: [{ occupied: 1 }] };
    if (sql.includes("join public.matching_result")) {
      return { rows: [{ applicationId: NEXT_APP, status: "waiting_pool", matchingScore: 70, appliedAt: "2026-10-08T02:00:00Z", userId: "u-next" }] };
    }
    if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    return { rows: [], rowCount: 1 };
  });
});

/** An open attempt for APP_ID; userId = the signed-in user so applicant routes see it as theirs. */
function openAttempt(overrides = {}) {
  attempt = {
    interviewId: INTERVIEW_ID,
    applicationId: APP_ID,
    status: "pending_confirmation",
    scheduledAt: inHours(48),
    confirmDueAt: inHours(24),
    vacancyId: VACANCY_ID,
    applicantId: APPLICANT_ID,
    userId: USER_ID,
    applicantName: "Ana Cruz",
    jobTitle: "Store Crew",
    ...overrides,
  };
  lockedApp.status = attempt.status === "confirmed" ? "interview_confirmed" : "interview_scheduled";
}

describe("roles", () => {
  it("TC-10: applicants cannot use the HR interview routes; HR cannot use the applicant ones", async () => {
    role = "applicant";
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(403);
    expect((await call("get", "/api/admin/interviews")).status).toBe(403);
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(403);
    role = "hr";
    expect((await call("get", "/api/applicant/interviews")).status).toBe(403);
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/reschedule-request`).send({ reason: "Medical check-up" })).status).toBe(403);
  });

  it("admin can schedule like HR (PRD §2)", async () => {
    role = "admin";
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(201);
  });
});

describe("POST /api/admin/interviews (FR-INT-02; TC-43)", () => {
  it("decision 16: the fully-verified check reads the application's own resume under the lock", async () => {
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).toBe(201);
    const lock = txCalls.findIndex((c) => c.sql.includes("from public.application where application_id = $1 for update"));
    const read = txCalls.findIndex((c) => c.sql.includes("join public.resume r on r.resume_id = a.resume_id"));
    expect(txCalls[read].params).toEqual([APP_ID]);
    expect(read).toBeGreaterThan(lock);
    expect(txCalls.some((c) => c.sql.includes("is_current") && c.sql.includes("from public.resume"))).toBe(false);
  });

  it("decision 16: the application's resume still unverified (e.g. archived but never checked) → 422, nothing scheduled", async () => {
    resume = { ...resume, verificationStatus: "pending" };
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Verify the resume and every document before scheduling the interview.");
    expect(txSql("insert into public.interview_schedule")).toHaveLength(0);
  });

  it("decision 37: schedules a shortlisted, fully verified applicant: attempt 1 set at once, interview_confirmed, applicant notified only", async () => {
    const body = scheduleBody();
    const res = await call("post", "/api/admin/interviews").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ interviewId: INTERVIEW_ID, attemptNumber: 1, status: "confirmed", applicationStatus: "interview_confirmed" });

    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]); // DATABASE_SCHEMA §8

    const [insert] = txSql("insert into public.interview_schedule");
    const [applicationId, interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt, createdBy, attemptNumber, status] = insert.params;
    expect([applicationId, interviewerId, durationMinutes, meetingLink, createdBy, attemptNumber]).toEqual([
      APP_ID, INTERVIEWER_ID, 30, body.meetingLink, USER_ID, 1,
    ]);
    expect(scheduledAt).toBe(body.scheduledAt);
    expect(status).toBe("confirmed"); // set at once: nothing for the applicant to confirm
    expect(insert.sql).toContain("$9::public.interview_status");
    expect(insert.sql).not.toContain("confirmed_at"); // confirmed_at stays null: the applicant never confirmed
    expect(confirmDueAt).toBe(body.scheduledAt); // NOT NULL column: the interview time, no confirmation deadline

    expect(appMoves().map((c) => c.params.slice(1))).toEqual([["shortlisted", "interview_confirmed", "Interview scheduled"]]);
    expect(attemptMoves()).toHaveLength(0);
    const [note, ...others] = notifications();
    expect(others).toHaveLength(0); // no staff notice either
    expect(note.params.slice(0, 3)).toEqual([APPLICANT_USER, APP_ID, "interview_scheduled"]);
    expect(note.params[6]).toBe(false); // nothing to answer
    expect(note.params[4]).toMatch(/The meeting link is on your dashboard\.$/);
    expect(note.params[4]).not.toMatch(/confirm|meet\.google|claygo|company/i); // no confirm line, no link, no company
  });

  it("decision 37: no response deadline is read or written, even for an interview a week away", async () => {
    const body = scheduleBody({ scheduledAt: inHours(24 * 7) });
    expect((await call("post", "/api/admin/interviews").send(body)).status).toBe(201);
    expect(txSql("insert into public.interview_schedule")[0].params[5]).toBe(body.scheduledAt);
    expect(txSql("from public.system_setting")).toHaveLength(0);
  });

  it("validates the time, link, duration, and interviewer (400)", async () => {
    for (const body of [
      scheduleBody({ scheduledAt: inHours(-1) }),
      scheduleBody({ scheduledAt: "2026-10-12T10:00:00" }), // no offset: never browser-local time
      scheduleBody({ meetingLink: "http://meet.google.com/abc" }),
      scheduleBody({ meetingLink: "not a link" }),
      scheduleBody({ durationMinutes: 5 }),
      scheduleBody({ interviewerId: undefined }),
    ]) {
      expect((await call("post", "/api/admin/interviews").send(body)).status).toBe(400);
    }
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("409 when the application is no longer shortlisted", async () => {
    lockedApp.status = "waiting_pool";
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).toBe(409);
    expect(txSql("insert into public.interview_schedule")).toHaveLength(0);
  });

  it("422 until everything is verified (FR-SCR-06)", async () => {
    requests = [{ status: "pending" }];
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(422);
    requests = [];
    documents = [{ verificationStatus: "pending" }];
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(422);
  });

  it("422 for an applicant with ratings on file: never interviewed again (BR-21)", async () => {
    reuse = [{ sourceApplicationId: NEXT_APP, jobTitle: "Cashier", companyName: "Kabayan Mart", ratedAt: "2026-10-01" }];
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/reused ratings/);
    expect(txSql("insert into public.interview_schedule")).toHaveLength(0);
  });

  it("422 when the interviewer is not an active HR/admin account", async () => {
    interviewerActive = false;
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(422);
  });

  it("409 on a double schedule caught by the one-open-attempt index", async () => {
    duplicate = "interview_one_open_per_application";
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already has an interview/);
  });

  it("a unique violation on any other index is NOT mapped to 409", async () => {
    duplicate = "some_other_index";
    const res = await call("post", "/api/admin/interviews").send(scheduleBody());
    expect(res.status).not.toBe(409);
    expect(res.status).toBe(500);
  });

  it("404 for an unknown application", async () => {
    appRow = null;
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(404);
  });
});

describe("GET lists", () => {
  it("HR: combined list, optional vacancy filter", async () => {
    const res = await call("get", `/api/admin/interviews?vacancyId=${VACANCY_ID}`);
    expect(res.status).toBe(200);
    const listed = poolSql.find((c) => c.sql.includes('c.company_name as "companyName"'));
    expect(listed.params).toEqual([VACANCY_ID]);
    expect((await call("get", "/api/admin/interviews?vacancyId=x")).status).toBe(400);
  });

  it("HR: interviewer select lists active staff", async () => {
    const res = await call("get", "/api/admin/interviewers");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ userId: INTERVIEWER_ID, fullName: "Maria HR", role: "hr" }]);
  });

  it("applicant: job title only, no company / scores / status_reason / deadline; the link of a set interview", async () => {
    role = "applicant";
    const res = await call("get", "/api/applicant/interviews");
    expect(res.status).toBe(200);
    const { sql, params } = poolSql.find((c) => c.sql.includes("case when s.status"));
    expect(params).toEqual([USER_ID]);
    expect(sql).not.toMatch(/company|status_reason|matching|score|confirm_due_at|confirmed_at/i);
    expect(sql).toMatch(/case when s\.status = 'confirmed' then s\.meeting_link end as "meetingLink"/);
  });

  it("decision 37: the applicant list also has the final interview (time + details), never the company, sorted by time", async () => {
    role = "applicant";
    const basePool = pool.query.getMockImplementation();
    pool.query.mockImplementation(async (sql, params) => {
      if (sql.includes("case when s.status")) {
        poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        return { rows: [{ interviewId: INTERVIEW_ID, jobTitle: "Store Crew", scheduledAt: "2030-01-20T02:00:00.000Z", rescheduleRequests: 0 }] };
      }
      if (sql.includes("from public.endorsement_item i")) {
        poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        return { rows: [{ applicationId: NEXT_APP, jobTitle: "Cashier", scheduledAt: "2030-01-10T02:00:00.000Z", details: "Bring a valid ID." }] };
      }
      return basePool(sql, params);
    });
    const res = await call("get", "/api/applicant/interviews");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { kind: "final", applicationId: NEXT_APP, jobTitle: "Cashier", scheduledAt: "2030-01-10T02:00:00.000Z", details: "Bring a valid ID." },
      { kind: "agency", interviewId: INTERVIEW_ID, jobTitle: "Store Crew", scheduledAt: "2030-01-20T02:00:00.000Z", requestsLeft: 2 },
    ]);
    const final = poolSql.find((c) => c.sql.includes("from public.endorsement_item i"));
    expect(final.params).toEqual([USER_ID, "final_interview_scheduled", "pending"]);
    expect(final.sql).toContain('i.client_interview_at as "scheduledAt", i.final_interview_details as "details"');
    expect(final.sql).not.toMatch(/company|status_reason|score|outcome_remarks/i);
  });
});

describe("decision 37: the applicant never confirms an interview", () => {
  it("the old confirm route is gone (404) and writes nothing", async () => {
    role = "applicant";
    openAttempt();
    const res = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`);
    expect(res.status).toBe(404);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(attempt.status).toBe("pending_confirmation");
  });
});

describe("PATCH /api/admin/interviews/:id (HR edits the time)", () => {
  const edit = (overrides = {}) => {
    const { applicationId: _a, ...body } = scheduleBody(overrides);
    return call("patch", `/api/admin/interviews/${INTERVIEW_ID}`).send(body);
  };

  it("set interview: stays set, confirm_due_at follows the new time, applicant told to contact the agency if it fails", async () => {
    openAttempt({ status: "confirmed" });
    const newTime = inHours(50);
    const res = await edit({ scheduledAt: newTime });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("confirmed");
    expect(lockSequence()).toEqual(["job_vacancy", "application"]);
    const [update] = txSql("set interviewer_id");
    expect(update.params[5]).toBe(newTime); // decision 37: no confirmation deadline, the interview time
    expect(update.sql).toContain("confirm_due_at = $6,");
    expect(appMoves()).toHaveLength(0); // no status change: application …
    expect(attemptMoves()).toHaveLength(0); // … nor attempt
    expect(txSql("from public.system_setting")).toHaveLength(0);
    const [note] = notifications();
    expect(note.params[2]).toBe("interview_rescheduled");
    expect(note.params[4]).toMatch(/The meeting link is on your dashboard\. If you can't attend at the new time, please contact Confiable Manpower\.$/);
    expect(note.params[4]).not.toMatch(/confirm/i);
    expect(note.params[6]).toBe(false);
  });

  it("decision 37: HR may reschedule on its own after the interview time passed (new time + notice)", async () => {
    openAttempt({ status: "confirmed", scheduledAt: inHours(-3) });
    const res = await edit({ scheduledAt: inHours(30) });
    expect(res.status).toBe(200);
    expect(notifications().map((c) => c.params[2])).toEqual(["interview_rescheduled"]);
    expect(txSql("reschedule_requests + 1")).toHaveLength(0); // never counts as a request
  });

  it("old unconfirmed attempt: the status stays, no deadline line, nothing to answer", async () => {
    openAttempt();
    const body = await edit({ scheduledAt: inHours(10) });
    expect(body.status).toBe(200);
    expect(body.body.data.status).toBe("pending_confirmation");
    const [update] = txSql("set interviewer_id");
    expect(update.params[5]).toBe(update.params[2]);
    expect(notifications()[0].params[4]).not.toMatch(/confirm/i);
    expect(notifications()[0].params[6]).toBe(false);
  });

  it("400 for a past time; 409 once the attempt is no longer open", async () => {
    openAttempt();
    expect((await edit({ scheduledAt: inHours(-1) })).status).toBe(400);
    openAttempt();
    attempt.status = "no_show";
    lockedApp.status = "dropped";
    expect((await edit()).status).toBe(409);
    expect(txSql("set interviewer_id")).toHaveLength(0);
  });
});

describe("POST /api/admin/interviews/:id/no-show (FR-INT-05 simplified, through the S12 drop service)", () => {
  it("confirmed + interview time passed: no_show, dropped (other — No-show), refill, applicant notified", async () => {
    openAttempt({ status: "confirmed", scheduledAt: inHours(-1), confirmDueAt: inHours(-30) });
    const res = await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ interviewId: INTERVIEW_ID, interviewStatus: "no_show", applicationId: APP_ID, status: "dropped", promoted: [NEXT_APP] });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the actor of the drop
    // drop's lock order, then the refresh re-takes the vacancy lock
    expect(lockSequence()).toEqual(["job_vacancy", "applicant", "application", "job_vacancy"]);

    expect(appMoves()).toHaveLength(2);
    expect(attemptMoves().map((c) => c.params.slice(1))).toEqual([["confirmed", "no_show"]]);
    const [drop, promote] = appMoves();
    expect(drop.params.slice(1)).toEqual(["interview_confirmed", "dropped", "Dropped by HR: Other — No-show"]);
    expect(promote.params.slice(1)).toEqual(["waiting_pool", "shortlisted", "shortlist refresh"]); // as the system
    const [dropped] = notifications();
    expect(dropped.params.slice(0, 3)).toEqual([APPLICANT_USER, APP_ID, "application_dropped"]);
    expect(dropped.params[4]).not.toMatch(/no-show|claygo|company|reason/i);
    // Decision 18 (answer 4): the no-show drop keeps the applicant in the applicant pool ("Waiting")
    expect(txSql("insert into public.talent_pool").map((c) => c.params)).toEqual([[APPLICANT_ID, APP_ID, "dropped"]]);
  });

  it("old unconfirmed attempt + deadline passed: expired, dropped (no_response)", async () => {
    openAttempt({ confirmDueAt: inHours(-1) });
    const res = await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`);
    expect(res.status).toBe(200);
    expect(res.body.data.interviewStatus).toBe("expired");
    expect(attemptMoves().map((c) => c.params.slice(1))).toEqual([["pending_confirmation", "expired"]]);
    expect(appMoves()[0].params.slice(1)).toEqual(["interview_scheduled", "dropped", "Dropped by HR: No response by the deadline"]);
  });

  it("409 before the deadline (unconfirmed) or before the interview time (confirmed); nothing changes", async () => {
    openAttempt();
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(409);
    openAttempt({ status: "confirmed", confirmDueAt: inHours(-1) });
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(409);
    expect(appMoves()).toHaveLength(0);
    expect(attemptMoves()).toHaveLength(0);
    expect(notifications()).toHaveLength(0);
  });

  it("404 for an unknown interview", async () => {
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(404);
  });
});

describe("no-show vs reschedule request: both re-check under the application lock, the second one gets 409", () => {
  // Decision 37 replaces the old confirm/no-show race: a set interview whose time just passed.
  it("no-show first, then a request → 409 (attempt no_show, application dropped)", async () => {
    openAttempt({ status: "confirmed", scheduledAt: inHours(-1), rescheduleRequests: 0 });
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(200);
    role = "applicant";
    const res = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/reschedule-request`).send({ reason: "I was sick that day." });
    expect(res.status).toBe(409);
    expect(attempt.status).toBe("no_show");
    expect(lockedApp.status).toBe("dropped");
  });
});

// ---------------------------------------------------------------- Phase 4 (decision 20; FR-INT-03, BR-09; TC-45, TC-111, TC-112)
describe("reschedule requests (decision 20)", () => {
  const REASON = "I have a medical check-up at that time.";
  const requestIt = () => call("post", `/api/applicant/interviews/${INTERVIEW_ID}/reschedule-request`).send({ reason: REASON });
  const approve = (overrides = {}) => {
    const { applicationId: _a, ...body } = scheduleBody({ scheduledAt: inHours(72), ...overrides });
    return call("post", `/api/admin/interviews/${INTERVIEW_ID}/reschedule/approve`).send(body);
  };
  const decline = () => call("post", `/api/admin/interviews/${INTERVIEW_ID}/reschedule/decline`);
  const staffNotices = () => txSql("insert into public.notification").filter((c) => c.sql.includes("from public.user_account"));
  const applicantNotices = () => txSql("insert into public.notification").filter((c) => !c.sql.includes("from public.user_account"));
  let setting;

  beforeEach(() => {
    setting = null;
    const base = txClient.query.getMockImplementation();
    txClient.query.mockImplementation(async (sql, params) => {
      // markRescheduleRequested: stale-read safe like the real UPDATE ... where status = $2
      if (sql.includes("reschedule_reason = $4")) {
        txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        if (!attempt || attempt.status !== params[1]) return { rows: [], rowCount: 0 };
        attempt.status = params[2];
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("reschedule_requests = reschedule_requests + 1")) {
        txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        attempt.rescheduleRequests += 1;
        return { rows: [{ rescheduleRequests: attempt.rescheduleRequests }], rowCount: 1 };
      }
      return base(sql, params);
    });
    const basePool = pool.query.getMockImplementation();
    pool.query.mockImplementation(async (sql, params) =>
      sql.includes("setting_key = 'max_reschedules'") ? { rows: setting === null ? [] : [{ value: String(setting) }] } : basePool(sql, params),
    );
  });

  const waiting = (overrides = {}) => {
    openAttempt({ attemptNumber: 1, rescheduleRequests: 0, companyName: "ClayGo", durationMinutes: 30, ...overrides });
  };

  describe("applicant request", () => {
    beforeEach(() => {
      role = "applicant";
    });

    it("pending attempt → reschedule_requested with the reason, counted, staff told (company allowed), status unchanged", async () => {
      waiting();
      const res = await requestIt();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ interviewId: INTERVIEW_ID, status: "reschedule_requested", requestsLeft: 1 });
      expect(lockSequence()).toEqual(["job_vacancy", "application"]);
      expect(txSql("reschedule_reason = $4")[0].params).toEqual([INTERVIEW_ID, "pending_confirmation", "reschedule_requested", REASON]);
      expect(txSql("reschedule_requests + 1")[0].params).toEqual([APP_ID]);
      expect(appMoves()).toHaveLength(0);
      expect(lockedApp.status).toBe("interview_scheduled");
      const [note] = staffNotices();
      expect(note.params[3]).toBe("hr_reschedule_requested");
      expect(note.params[4]).toBe("Reschedule requested: Ana Cruz");
      expect(note.params[5]).toMatch(
        /^Ana Cruz asked to reschedule the interview for Store Crew at ClayGo on .+ \(Philippine time\)\. Reason: "I have a medical check-up at that time\."\. Approve with a new time or decline in Interview Assessment\.$/,
      );
      expect(applicantNotices()).toHaveLength(0);
      expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // the applicant is the actor
    });

    it("from a confirmed attempt too", async () => {
      waiting({ status: "confirmed" });
      const res = await requestIt();
      expect(res.status).toBe(200);
      expect(txSql("reschedule_reason = $4")[0].params[1]).toBe("confirmed");
      expect(lockedApp.status).toBe("interview_confirmed");
    });

    it("the 3rd request → 422 even when the earlier ones were declined; nothing written", async () => {
      waiting({ rescheduleRequests: 2 });
      const res = await requestIt();
      expect(res.status).toBe(422);
      expect(res.body.error.message).toBe("You have used both reschedule requests. Please contact Confiable Manpower.");
      expect(txSql("reschedule_reason = $4")).toHaveLength(0);
      expect(txSql("reschedule_requests + 1")).toHaveLength(0);
    });

    it("a setting above 2 is capped at 2 (attempt_number 1..3); a setting of 1 allows one", async () => {
      setting = 3;
      waiting({ rescheduleRequests: 2 });
      expect((await requestIt()).status).toBe(422);
      setting = 1;
      waiting({ rescheduleRequests: 1 });
      expect((await requestIt()).status).toBe(422);
      waiting({ rescheduleRequests: 0 });
      const res = await requestIt();
      expect(res.status).toBe(200);
      expect(res.body.data.requestsLeft).toBe(0);
    });

    it("refused once the interview time passed (409), while a request already waits (409), and for another applicant (404)", async () => {
      waiting({ scheduledAt: inHours(-1) });
      const late = await requestIt();
      expect(late.status).toBe(409);
      expect(late.body.error.message).toBe("The interview time has passed. Please contact Confiable Manpower.");
      waiting({ status: "reschedule_requested" });
      lockedApp.status = "interview_scheduled";
      const twice = await requestIt();
      expect(twice.status).toBe(409);
      expect(twice.body.error.message).toBe("Your reschedule request is waiting for the agency.");
      waiting({ userId: "someone-else" });
      expect((await requestIt()).status).toBe(404);
      expect(txSql("reschedule_requests + 1")).toHaveLength(0);
    });

    it("a reason under 5 characters → 400", async () => {
      waiting();
      const res = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/reschedule-request`).send({ reason: " ok " });
      expect(res.status).toBe(400);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it("the applicant list carries requestsLeft (setting default 2), never the counter or a reason", async () => {
      const basePool = pool.query.getMockImplementation();
      pool.query.mockImplementation(async (sql, params) =>
        sql.includes("case when s.status")
          ? (poolSql.push({ sql: sql.replace(/\s+/g, " ").trim(), params }),
            { rows: [{ interviewId: INTERVIEW_ID, jobTitle: "Store Crew", rescheduleRequests: 1 }] })
          : basePool(sql, params),
      );
      const res = await call("get", "/api/applicant/interviews");
      expect(res.body.data).toEqual([{ kind: "agency", interviewId: INTERVIEW_ID, jobTitle: "Store Crew", requestsLeft: 1 }]);
      const { sql } = poolSql.find((c) => c.sql.includes("case when s.status"));
      expect(sql).toContain("s.status in ('pending_confirmation', 'confirmed', 'reschedule_requested')");
      expect(sql).not.toMatch(/company|status_reason|matching|score|reschedule_reason/i);
    });
  });

  describe("HR approve", () => {
    it("decision 37: old attempt rescheduled, attempt 2 set at once (confirmed), application stays, applicant told (no confirm line)", async () => {
      waiting({ status: "reschedule_requested" });
      lockedApp.status = "interview_confirmed";
      const newTime = inHours(72);
      const res = await approve({ scheduledAt: newTime });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: "confirmed", attemptNumber: 2, applicationStatus: "interview_confirmed" });
      expect(lockSequence()).toEqual(["job_vacancy", "application"]);
      expect(attemptMoves().map((c) => c.params.slice(1))).toEqual([["reschedule_requested", "rescheduled"]]);
      const insert = txSql("insert into public.interview_schedule")[0];
      expect(insert.params[0]).toBe(APP_ID);
      expect(insert.params[5]).toBe(newTime); // confirm_due_at = the interview time
      expect(insert.params[7]).toBe(2); // attempt_number
      expect(insert.params[8]).toBe("confirmed");
      expect(appMoves()).toHaveLength(0);
      expect(txSql("from public.system_setting")).toHaveLength(0);
      const [note] = applicantNotices();
      expect(note.params[2]).toBe("interview_rescheduled");
      expect(note.params[4]).toMatch(
        /The meeting link is on your dashboard\. If you can't attend at the new time, please contact Confiable Manpower\.$/,
      );
      expect(note.params[4]).not.toMatch(/confirm|ClayGo|https?:/i);
      expect(note.params[6]).toBe(false);
    });

    it("an old interview_scheduled row is set by the approval: interview_scheduled → interview_confirmed through the status machine", async () => {
      waiting({ status: "reschedule_requested", attemptNumber: 2 });
      lockedApp.status = "interview_scheduled";
      const res = await approve();
      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("interview_confirmed");
      expect(appMoves().map((c) => c.params.slice(1))).toEqual([["interview_scheduled", "interview_confirmed", "Reschedule approved"]]);
      expect(txSql("insert into public.interview_schedule")[0].params.slice(7)).toEqual([3, "confirmed"]);
    });

    it("409 when no request waits (nothing written); 422 for an inactive interviewer", async () => {
      waiting();
      const res = await approve();
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("There is no reschedule request to answer. Refresh the page.");
      expect(txSql("insert into public.interview_schedule")).toHaveLength(0);
      waiting({ status: "reschedule_requested" });
      interviewerActive = false;
      expect((await approve()).status).toBe(422);
      expect(attemptMoves()).toHaveLength(0);
    });

    it("400 for a past time; an applicant token → 403", async () => {
      waiting({ status: "reschedule_requested" });
      expect((await approve({ scheduledAt: inHours(-2) })).status).toBe(400);
      role = "applicant";
      expect((await approve()).status).toBe(403);
      expect((await decline()).status).toBe(403);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it("while waiting: HR edit and no-show → 409 'Answer the reschedule request first.'", async () => {
      waiting({ status: "reschedule_requested", scheduledAt: inHours(-1) });
      lockedApp.status = "interview_confirmed";
      const { applicationId: _a, ...body } = scheduleBody();
      const edit = await call("patch", `/api/admin/interviews/${INTERVIEW_ID}`).send(body);
      expect(edit.status).toBe(409);
      expect(edit.body.error.message).toBe("Answer the reschedule request first.");
      const noShow = await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`);
      expect(noShow.status).toBe(409);
      expect(noShow.body.error.message).toBe("Answer the reschedule request first.");
      expect(appMoves()).toHaveLength(0);
    });
  });

  describe("HR decline", () => {
    it("old unconfirmed row: back to pending_confirmation, no deadline line, nothing to answer", async () => {
      waiting({ status: "reschedule_requested" });
      lockedApp.status = "interview_scheduled";
      const res = await decline();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ interviewId: INTERVIEW_ID, status: "pending_confirmation", applicationStatus: "interview_scheduled" });
      expect(lockSequence()).toEqual(["job_vacancy", "application"]);
      expect(attemptMoves().map((c) => c.params.slice(1))).toEqual([["reschedule_requested", "pending_confirmation"]]);
      expect(txSql("reschedule_requests + 1")).toHaveLength(0); // the request already counted
      const [note] = applicantNotices();
      expect(note.params[2]).toBe("reschedule_declined");
      expect(note.params[3]).toBe("Reschedule request declined: Store Crew");
      expect(note.params[4]).toMatch(
        /^Your interview for Store Crew stays on .+\(Philippine time\)\. If you can't attend, please contact Confiable Manpower\.$/,
      );
      expect(note.params[6]).toBe(false);
    });

    it("confirmed: back to confirmed, no confirm line, no action", async () => {
      waiting({ status: "reschedule_requested" });
      lockedApp.status = "interview_confirmed";
      const res = await decline();
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("confirmed");
      const [note] = applicantNotices();
      expect(note.params[4]).toMatch(/^Your interview for Store Crew stays on .+\(Philippine time\)\. If you can't attend/);
      expect(note.params[4]).not.toMatch(/confirm it/);
      expect(note.params[6]).toBe(false);
      expect(appMoves()).toHaveLength(0);
    });

    it("409 when no request waits", async () => {
      waiting({ status: "confirmed" });
      expect((await decline()).status).toBe(409);
      expect(attemptMoves()).toHaveLength(0);
    });
  });

  it("HR list: waiting requests included, with the reason only while requested", async () => {
    expect((await call("get", "/api/admin/interviews")).status).toBe(200);
    const { sql } = poolSql.find((c) => c.sql.includes('as "rescheduleReason"'));
    expect(sql).toContain("s.status in ('pending_confirmation', 'confirmed', 'reschedule_requested')");
    expect(sql).toContain(`case when s.status = 'reschedule_requested' then s.reschedule_reason end as "rescheduleReason"`);
  });
});
