// Applicant Management list (S18; PRD FR-ADM-02): search with LIKE escaping, the status filter from the dashboard
// tiles, paging with the server cap (50), the current-application selection (ongoing or hired first, then the latest),
// the total from its own count query, and roles.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const ONGOING_AND_HIRED = [
  "waiting_pool", "shortlisted", "interview_scheduled", "interview_confirmed",
  "passed", "passed_awaiting_confirmation", "for_endorsement", "endorsed",
  "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation", "hired",
];
const ROW = {
  applicantId: "p1", applicantName: "Juan Dela Cruz", email: "juan@vera.test", applicationId: "a1", status: "endorsed",
  jobTitle: "Cashier", companyName: "Kabayan Mart", lastUpdate: "2030-10-10T06:00:00.000Z",
};

let role;
let total;

const pageCall = () => pool.query.mock.calls.find(([sql]) => sql.includes("limit $5 offset $6"));
const countCall = () => pool.query.mock.calls.find(([sql]) => sql.includes("count(*)::int as total"));
const list = (query = {}) => request(app).get("/api/admin/applicants").query(query).set("Authorization", "Bearer t");

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  total = 1;
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
    if (sql.includes("limit $5 offset $6")) return { rows: [ROW] };
    if (sql.includes("count(*)::int as total")) return { rows: [{ total }] };
    throw new Error(`unexpected query: ${sql}`);
  });
});

describe("GET /api/admin/applicants (FR-ADM-02)", () => {
  it("returns the rows with exact keys and meta from the count query (defaults: page 1, 20 per page, no filter)", async () => {
    total = 37;
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [ROW], meta: { page: 1, pageSize: 20, total: 37 } });
    expect(pageCall()[1]).toEqual(["%%", ONGOING_AND_HIRED, null, false, 20, 0]);
    expect(countCall()[1]).toEqual(["%%", ONGOING_AND_HIRED, null, false]);
  });

  it("search escapes %, _ and \\ and matches name or email with ILIKE", async () => {
    await list({ search: "  50%_a\\b  " });
    expect(pageCall()[1][0]).toBe("%50\\%\\_a\\\\b%");
    expect(countCall()[1][0]).toBe("%50\\%\\_a\\\\b%");
    const [sql] = pageCall();
    expect(sql).toContain("concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix) ilike $1 or u.email ilike $1");
  });

  it("paging: pageSize above 50 is clamped to 50; page 3 → offset 100", async () => {
    const res = await list({ page: 3, pageSize: 500 });
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 3, pageSize: 50, total: 1 });
    expect(pageCall()[1].slice(4)).toEqual([50, 100]);
  });

  it("the status filter uses the dashboard tile's statuses; applicantPool uses the pool-view condition", async () => {
    await list({ status: "forEndorsement" });
    expect(pageCall()[1].slice(2, 4)).toEqual([
      ["for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation"],
      false,
    ]);

    vi.clearAllMocks();
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    await list({ status: "applicantPool" });
    expect(pageCall()[1].slice(2, 4)).toEqual([null, true]);
    const [sql] = pageCall();
    expect(sql).toContain("tp.removed_at is null");
    expect(sql).toContain("b.applicant_id = tp.applicant_id and b.status = any($2::public.application_status[])");
  });

  it("current application: the ongoing or hired one first, then the latest by updated_at", async () => {
    await list();
    const [sql, params] = pageCall();
    expect(sql).toContain("select distinct on (a.applicant_id)");
    expect(sql).toContain(
      "order by a.applicant_id, (a.status = any($2::public.application_status[])) desc, a.updated_at desc, a.application_id desc",
    );
    expect(params[1]).toEqual(ONGOING_AND_HIRED);
    expect(sql).toContain('order by "lastUpdate" desc, p.applicant_id');
  });

  it("an unknown status filter or a bad page → 400", async () => {
    expect((await list({ status: "passed" })).status).toBe(400);
    expect((await list({ page: 0 })).status).toBe(400);
  });

  it("roles: an applicant gets 403; no token gets 401", async () => {
    role = "applicant";
    const forbidden = await list();
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
    const anonymous = await request(app).get("/api/admin/applicants");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
  });
});
