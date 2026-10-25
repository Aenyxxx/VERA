// HR dashboard (S18; PRD FR-ADM-01, TC-63): one definition per tile in @vera/shared, all counts in ONE statement whose
// parameters are those definitions, the applicant pool tile through the S17 pool-view condition, upcoming interviews
// from the database clock, and roles. The mocked database evaluates the statement's parameters against a fixture that
// covers every application status and every vacancy status, so the expected numbers below are hard-coded.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { APPLICATION_STATUS, DASHBOARD_TILE_ORDER, DASHBOARD_TILES, VACANCY_STATUS } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const ONGOING_AND_HIRED = [
  "waiting_pool", "shortlisted", "interview_scheduled", "interview_confirmed",
  "passed", "passed_awaiting_confirmation", "for_endorsement", "endorsed",
  "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation", "hired",
];

// 19 applicant profiles; p14 never applied.
const APPLICANTS = Array.from({ length: 19 }, (_, i) => `p${i + 1}`);
// Every one of the 24 application statuses appears at least once.
const APPLICATIONS = [
  ["p1", "waiting_pool"],
  ["p2", "shortlisted"],
  ["p3", "shortlisted"],
  ["p4", "interview_scheduled"],
  ["p5", "interview_confirmed"],
  ["p6", "for_endorsement"],
  ["p7", "endorsed"],
  ["p8", "passed_awaiting_confirmation"], // in no tile
  ["p9", "passed"], // in no tile
  ["p10", "hired"],
  ["p10", "did_not_pass"], // an earlier final application of the hired applicant
  ["p11", "not_hired"],
  ["p12", "training_failed"],
  ["p12", "prescreen_failed"],
  ["p12", "below_threshold"],
  ["p13", "standby"],
  ["p13", "terminated"],
  ["p13", "dropped"],
  ["p13", "archived"],
  ["p13", "not_selected"],
  ["p15", "final_interview_scheduled"], // Phase 2: with the client → For endorsement tile
  ["p16", "for_hiring"], // Phase 2: with the client → For endorsement tile
  ["p17", "for_training"], // decision 37C: the client stages → For endorsement tile
  ["p18", "for_requirements"],
  ["p19", "for_orientation"],
].map(([applicantId, status]) => ({ applicantId, status }));
// Pool entries: p11 and p13 free; p1 blocked (ongoing waiting_pool); p12 removed; p10 blocked (hired).
const POOL = [
  { applicantId: "p11", removed: false },
  { applicantId: "p13", removed: false },
  { applicantId: "p1", removed: false },
  { applicantId: "p12", removed: true },
  { applicantId: "p10", removed: false },
];
// Every vacancy status once, plus a second open one.
const VACANCIES = ["draft", "open", "open", "closed", "endorsing", "filled", "archived"];

const UPCOMING = [
  { interviewId: "s1", applicationId: "a4", status: "pending_confirmation", scheduledAt: "2030-10-12T01:00:00.000Z", durationMinutes: 30, applicantName: "Dan Uy", vacancyId: "v1", jobTitle: "Cashier", companyName: "Kabayan Mart", interviewerName: "VERA HR" },
];

let role;
let countCalls;

function distinctApplicants(statuses) {
  return new Set(APPLICATIONS.filter((a) => statuses.includes(a.status)).map((a) => a.applicantId)).size;
}

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  countCalls = [];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes('as "activeVacancies"')) {
      countCalls.push({ sql, params });
      const [waiting, screening, interview, endorsement, hired, blocking, vacancyStatuses] = params;
      const free = POOL.filter(
        (e) => !e.removed && !APPLICATIONS.some((a) => a.applicantId === e.applicantId && blocking.includes(a.status)),
      ).length;
      return {
        rows: [
          {
            applicants: APPLICANTS.length,
            waitingPool: distinctApplicants(waiting),
            forScreening: distinctApplicants(screening),
            forInterview: distinctApplicants(interview),
            forEndorsement: distinctApplicants(endorsement),
            hired: distinctApplicants(hired),
            applicantPool: free,
            activeVacancies: VACANCIES.filter((s) => vacancyStatuses.includes(s)).length,
          },
        ],
      };
    }
    if (sql.includes("from public.interview_schedule s")) return { rows: UPCOMING };
    throw new Error(`unexpected query: ${sql}`);
  });
});

const getDashboard = () => request(app).get("/api/admin/dashboard").set("Authorization", "Bearer t");

describe("dashboard tile definitions (@vera/shared, one per tile)", () => {
  it("pins every tile's set and the display order", () => {
    expect(DASHBOARD_TILE_ORDER).toEqual([
      "applicants", "waitingPool", "forScreening", "forInterview", "forEndorsement", "hired", "applicantPool", "activeVacancies",
    ]);
    expect(DASHBOARD_TILES.waitingPool.statuses).toEqual(["waiting_pool"]);
    expect(DASHBOARD_TILES.forScreening.statuses).toEqual(["shortlisted"]);
    expect(DASHBOARD_TILES.forInterview.statuses).toEqual(["interview_scheduled", "interview_confirmed"]);
    expect(DASHBOARD_TILES.forEndorsement.statuses).toEqual([
      "for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation",
    ]);
    expect(DASHBOARD_TILES.hired.statuses).toEqual(["hired"]);
    expect(DASHBOARD_TILES.applicantPool.blockingStatuses).toEqual(ONGOING_AND_HIRED);
    expect(DASHBOARD_TILES.activeVacancies.vacancyStatuses).toEqual(["open", "closed", "endorsing"]);
  });

  it("the fixture covers every application status and every vacancy status", () => {
    expect([...new Set(APPLICATIONS.map((a) => a.status))].sort()).toEqual(Object.values(APPLICATION_STATUS).sort());
    expect([...new Set(VACANCIES)].sort()).toEqual(Object.values(VACANCY_STATUS).sort());
  });
});

describe("GET /api/admin/dashboard (FR-ADM-01)", () => {
  it("returns the 8 tiles with exact counts, in order, each with its own definition", async () => {
    const res = await getDashboard();
    expect(res.status).toBe(200);
    expect(res.body.data.tiles).toEqual([
      { key: "applicants", label: "Total applicants", counts: "profiles", value: 19 },
      { key: "waitingPool", label: "Waiting pool", counts: "distinct applicants", statuses: ["waiting_pool"], value: 1 },
      { key: "forScreening", label: "For screening", counts: "distinct applicants", statuses: ["shortlisted"], value: 2 },
      { key: "forInterview", label: "For interview", counts: "distinct applicants", statuses: ["interview_scheduled", "interview_confirmed"], value: 2 },
      // passed and passed_awaiting_confirmation (p8, p9) are in no tile
      // p6, p7, p15 (final interview scheduled), p16 (for hiring), p17–p19 (decision 37C stages)
      {
        key: "forEndorsement", label: "For endorsement", counts: "distinct applicants",
        statuses: ["for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation"],
        value: 7,
      },
      { key: "hired", label: "Hired", counts: "distinct applicants", statuses: ["hired"], value: 1 },
      // p11 and p13 only: p1 is ongoing, p10 hired, p12's entry removed
      { key: "applicantPool", label: "Applicant pool", counts: "free pool entries", blockingStatuses: ONGOING_AND_HIRED, value: 2 },
      // open × 2, closed, endorsing; not draft, filled, archived
      { key: "activeVacancies", label: "Active vacancies", counts: "vacancies", vacancyStatuses: ["open", "closed", "endorsing"], value: 4 },
    ]);
  });

  it("counts in ONE statement whose parameters are the tile sets; the pool tile uses the S17 pool-view condition", async () => {
    await getDashboard();
    expect(countCalls).toHaveLength(1);
    const [{ sql, params }] = countCalls;
    expect(params).toEqual([
      ["waiting_pool"],
      ["shortlisted"],
      ["interview_scheduled", "interview_confirmed"],
      ["for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation"],
      ["hired"],
      ONGOING_AND_HIRED,
      ["open", "closed", "endorsing"],
    ]);
    expect(sql).toContain("count(distinct a.applicant_id)::int from public.application a");
    expect(sql).toContain("tp.removed_at is null");
    expect(sql).toContain("b.applicant_id = tp.applicant_id and b.status = any($6::public.application_status[])");
    expect(sql).toContain("v.status = any($7::public.vacancy_status[])");
  });

  it("upcoming interviews: open attempts of applications in interview, from the start of today in Philippine time (decision 40-2), earliest first, at most 10", async () => {
    const res = await getDashboard();
    expect(res.body.data.upcomingInterviews).toEqual(UPCOMING);
    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes("from public.interview_schedule s"));
    // Phase 4: a waiting reschedule request still shows (HR must answer it)
    expect(params).toEqual([
      ["pending_confirmation", "confirmed", "reschedule_requested"],
      ["interview_scheduled", "interview_confirmed"],
      10,
      "Asia/Manila",
    ]);
    // decision 40-2: midnight today in Manila (database clock), not "now": a started interview stays listed today
    expect(sql).toContain("s.scheduled_at >= (date_trunc('day', now() at time zone $4::text) at time zone $4::text)");
    expect(sql).not.toContain("s.scheduled_at >= now()");
    expect(sql).toContain("order by s.scheduled_at, s.interview_schedule_id");
    expect(sql).toContain("limit $3");
  });

  it("roles: an applicant gets 403; no token gets 401", async () => {
    role = "applicant";
    const forbidden = await getDashboard();
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
    const anonymous = await request(app).get("/api/admin/dashboard");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
  });
});
