// Interview scheduling (S13; PRD FR-INT-01/02/05 simplified; TC-43): schedule from the review sheet, applicant
// confirm, HR edit, Mark no-show through the S12 drop service, both orders of a confirm/no-show race, lock order.
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
  documents = [{ documentId: "d1", documentType: "nbi_clearance", verificationStatus: "verified" }];
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
    if (sql.includes("from public.resume") && sql.includes("original_filename")) return { rows: resume ? [resume] : [] };
    if (sql.includes("from public.document_request\n")) return { rows: requests };
    if (sql.includes("with latest as")) return { rows: reuse };
    if (sql.includes("select 1 from public.user_account")) return { rows: interviewerActive ? [{ "?column?": 1 }] : [] };
    if (sql.includes("from public.system_setting")) return { rows: [{ days: 3 }] };
    if (sql.includes("insert into public.interview_schedule")) {
      if (duplicate) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: duplicate });
      return { rows: [{ interviewId: INTERVIEW_ID, status: "pending_confirmation", attemptNumber: 1, scheduledAt: params[2], confirmDueAt: params[5] }] };
    }
    if (sql.includes("set interviewer_id")) {
      return { rows: [{ interviewId: INTERVIEW_ID, status: attempt.status, scheduledAt: params[2], confirmDueAt: params[5] ?? attempt.confirmDueAt }] };
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
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(403);
  });

  it("admin can schedule like HR (PRD §2)", async () => {
    role = "admin";
    expect((await call("post", "/api/admin/interviews").send(scheduleBody())).status).toBe(201);
  });
});

describe("POST /api/admin/interviews (FR-INT-02; TC-43)", () => {
  it("schedules a shortlisted, fully verified applicant: attempt 1, interview_scheduled, applicant notified", async () => {
    const body = scheduleBody();
    const res = await call("post", "/api/admin/interviews").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ interviewId: INTERVIEW_ID, attemptNumber: 1, applicationStatus: "interview_scheduled" });

    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // HR is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]); // DATABASE_SCHEMA §8

    const [insert] = txSql("insert into public.interview_schedule");
    const [applicationId, interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt, createdBy] = insert.params;
    expect([applicationId, interviewerId, durationMinutes, meetingLink, createdBy]).toEqual([APP_ID, INTERVIEWER_ID, 30, body.meetingLink, USER_ID]);
    expect(scheduledAt).toBe(body.scheduledAt);
    // BR-08: now + 3 days, but never after the interview (48 h away) → the interview time
    expect(confirmDueAt.toISOString()).toBe(body.scheduledAt);

    expect(appMoves()[0].params.slice(1, 3)).toEqual(["shortlisted", "interview_scheduled"]);
    const [note] = notifications();
    expect(note.params.slice(0, 3)).toEqual([APPLICANT_USER, APP_ID, "interview_scheduled"]);
    expect(note.params[6]).toBe(true); // requires action
    expect(note.params[4]).not.toMatch(/meet\.google|claygo|company/i); // no link, no company
  });

  it("the deadline is now + response_deadline_days when the interview is later than that", async () => {
    const body = scheduleBody({ scheduledAt: inHours(24 * 7) });
    await call("post", "/api/admin/interviews").send(body);
    const due = txSql("insert into public.interview_schedule")[0].params[5];
    expect(Math.abs(due.getTime() - (Date.now() + 3 * 24 * HOUR))).toBeLessThan(60_000);
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

  it("applicant: job title only, no company / scores / status_reason; link only once confirmed", async () => {
    role = "applicant";
    const res = await call("get", "/api/applicant/interviews");
    expect(res.status).toBe(200);
    const { sql, params } = poolSql.find((c) => c.sql.includes("case when s.status"));
    expect(params).toEqual([USER_ID]);
    expect(sql).not.toMatch(/company|status_reason|matching|score/i);
    expect(sql).toMatch(/case when s\.status = 'confirmed' then s\.meeting_link end as "meetingLink"/);
  });
});

describe("POST /api/applicant/interviews/:id/confirm", () => {
  beforeEach(() => {
    role = "applicant";
  });

  it("confirms: attempt confirmed, interview_confirmed by the applicant, staff notified", async () => {
    openAttempt();
    const res = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ interviewId: INTERVIEW_ID, status: "confirmed", applicationStatus: "interview_confirmed" });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID); // the applicant is the history actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]);
    expect(attempt.status).toBe("confirmed");
    expect(lockedApp.status).toBe("interview_confirmed");
    const [move] = attemptMoves();
    expect(move.params).toEqual([INTERVIEW_ID, "pending_confirmation", "confirmed"]);
    expect(move.sql).toMatch(/set status = \$3::public\.interview_status,/);
    expect(move.sql).toMatch(
      /confirmed_at = case when \$3::public\.interview_status = 'confirmed' then now\(\) else confirmed_at end/,
    );
    expect(move.sql).toMatch(/and status = \$2::public\.interview_status$/);
    const [staff] = notifications();
    expect(staff.params[3]).toBe("hr_interview_confirmed");
  });

  it("404 for another applicant's interview (nothing written)", async () => {
    openAttempt({ userId: APPLICANT_USER });
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(404);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("409 on a second confirm", async () => {
    openAttempt();
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(200);
    const again = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already confirmed/);
  });

  it("allowed after the (unenforced) deadline; refused once the interview time passed", async () => {
    openAttempt({ confirmDueAt: inHours(-1) });
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(200);
    openAttempt({ scheduledAt: inHours(-1), confirmDueAt: inHours(-2) });
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(409);
  });
});

describe("PATCH /api/admin/interviews/:id (HR edits the time)", () => {
  const edit = (overrides = {}) => {
    const { applicationId: _a, ...body } = scheduleBody(overrides);
    return call("patch", `/api/admin/interviews/${INTERVIEW_ID}`).send(body);
  };

  it("confirmed: stays confirmed, deadline untouched, applicant told to contact the agency if the new time fails", async () => {
    openAttempt({ status: "confirmed" });
    const res = await edit({ scheduledAt: inHours(50) });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("confirmed");
    expect(lockSequence()).toEqual(["job_vacancy", "application"]);
    expect(txSql("set interviewer_id")[0].params[5]).toBeNull(); // coalesce keeps confirm_due_at
    expect(appMoves()).toHaveLength(0); // no status change: application …
    expect(attemptMoves()).toHaveLength(0); // … nor attempt
    const [note] = notifications();
    expect(note.params[2]).toBe("interview_rescheduled");
    expect(note.params[4]).toMatch(/If you can't attend at the new time, please contact Confiable Manpower\.$/);
    expect(note.params[4]).not.toMatch(/confirm it/);
    expect(note.params[6]).toBe(false);
  });

  it("awaiting confirmation: new deadline, requires action", async () => {
    openAttempt();
    const body = await edit({ scheduledAt: inHours(10) });
    expect(body.status).toBe(200);
    const due = txSql("set interviewer_id")[0].params[5];
    expect(due.toISOString()).toBe(txSql("set interviewer_id")[0].params[2]); // min(now + 3 days, interview)
    expect(notifications()[0].params[6]).toBe(true);
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
  });

  it("unconfirmed + deadline passed: expired, dropped (no_response)", async () => {
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

describe("confirm vs no-show race: both re-check under the application lock, the second one gets 409", () => {
  // HR's screen shows an unconfirmed attempt past its deadline; the interview itself is still ahead.
  const raceAttempt = () => openAttempt({ confirmDueAt: inHours(-1), scheduledAt: inHours(5) });

  it("confirm first, then no-show → 409 (now confirmed and the interview has not started)", async () => {
    raceAttempt();
    role = "applicant";
    expect((await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`)).status).toBe(200);
    role = "hr";
    const res = await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`);
    expect(res.status).toBe(409);
    expect(attempt.status).toBe("confirmed");
    expect(lockedApp.status).toBe("interview_confirmed");
  });

  it("no-show first, then confirm → 409 (attempt expired, application dropped)", async () => {
    raceAttempt();
    expect((await call("post", `/api/admin/interviews/${INTERVIEW_ID}/no-show`)).status).toBe(200);
    role = "applicant";
    const res = await call("post", `/api/applicant/interviews/${INTERVIEW_ID}/confirm`);
    expect(res.status).toBe(409);
    expect(attempt.status).toBe("expired");
    expect(lockedApp.status).toBe("dropped");
  });
});
