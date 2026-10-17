// User Management (decision 19, Phase 4; PRD FR-AUTH-07, FR-ADM-04; TC-08/09, TC-110): admin only; create HR through
// Supabase Auth (confirmed, role hr, password never logged or returned); deactivate (never yourself, never the last
// active admin, then the Supabase ban) and activate (unban first).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({
  supabaseAdmin: { auth: { getUser: vi.fn(), admin: { createUser: vi.fn(), updateUserById: vi.fn() } } },
}));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { logger } = await import("../src/lib/logger.js");
const { app } = await import("../src/app.js");

// The signed-in admin. A valid v4 id (Supabase ids are v4; the shared USER_ID fails z.uuid for the :id route).
const USER_ID = "11111111-1111-4111-8111-111111111111";
const HR_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN2_ID = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "Temp1234pass";
const BODY = { email: "  New.HR@Agency.test ", fullName: "Rosa Dela Cruz", temporaryPassword: PASSWORD };

const flat = (sql) => sql.replace(/\s+/g, " ").trim();
let role;
let queries; // pool queries after authentication
let txQueries;
let staff; // findStaff result
let taken;
let activeAdmins;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "error").mockImplementation(() => {});
  role = "admin";
  queries = [];
  txQueries = [];
  staff = { userId: HR_ID, email: "hr@vera.test", fullName: "HR One", role: "hr", accountStatus: "active" };
  taken = false;
  activeAdmins = [USER_ID];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: HR_ID } }, error: null });
  supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    const s = flat(sql);
    if (s.includes("from public.user_account where user_account_id = $1")) return { rows: [account({ role, userId: USER_ID })] }; // authenticate
    queries.push({ sql: s, params });
    if (s.includes("left join auth.users")) {
      return { rows: [{ userId: USER_ID, role: "admin" }, { userId: HR_ID, role: "hr" }] };
    }
    if (s.includes("u.user_account_id = $1 and u.role = any")) return { rows: staff ? [staff] : [] };
    if (s.includes("lower(email) = lower($1)")) return { rows: [{ taken }] };
    if (s.startsWith("insert into public.user_account")) {
      return { rows: [{ userId: params[0], email: params[1], fullName: params[3], role: params[2], accountStatus: params[4] }] };
    }
    if (s.startsWith("update public.user_account")) return { rows: [{ userId: params[0], accountStatus: params[1] }] };
    return { rows: [] };
  });
  txClient.query.mockImplementation(async (sql, params) => {
    const s = flat(sql);
    txQueries.push({ sql: s, params });
    if (s.includes("for update")) return { rows: activeAdmins.map((userId) => ({ userId })) };
    if (s.startsWith("update public.user_account")) return { rows: [{ userId: params[0], accountStatus: params[1] }] };
    return { rows: [] };
  });
});

const as = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");

describe("access (admin only)", () => {
  it.each(["hr", "applicant"])("%s → 403 on every endpoint, nothing read or written", async (r) => {
    role = r;
    expect((await as("get", "/api/admin/users")).status).toBe(403);
    expect((await as("post", "/api/admin/users").send(BODY)).status).toBe(403);
    expect((await as("patch", `/api/admin/users/${HR_ID}/status`).send({ accountStatus: "inactive" })).status).toBe(403);
    expect(queries).toEqual([]);
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/users", () => {
  it("lists staff accounts only and marks your own row", async () => {
    const res = await as("get", "/api/admin/users");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { userId: USER_ID, role: "admin", isSelf: true },
      { userId: HR_ID, role: "hr", isSelf: false },
    ]);
    expect(queries[0].params).toEqual([["admin", "hr"]]);
    expect(queries[0].sql).toContain("where u.role = any($1::public.user_role[])");
  });
});

describe("POST /api/admin/users", () => {
  it("creates a confirmed HR account in Supabase, records the creator, and never returns or logs the password", async () => {
    const res = await as("post", "/api/admin/users").send(BODY);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ userId: HR_ID, email: "new.hr@agency.test", fullName: "Rosa Dela Cruz", role: "hr", accountStatus: "active" });
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new.hr@agency.test",
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { vera_role: "hr" },
      user_metadata: { full_name: "Rosa Dela Cruz" },
    });
    const insert = queries.find((q) => q.sql.startsWith("insert into public.user_account"));
    expect(insert.params).toEqual([HR_ID, "new.hr@agency.test", "hr", "Rosa Dela Cruz", "active", USER_ID]);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(queries)).not.toContain(PASSWORD);
  });

  it("an email already in VERA → 409 before Supabase is called", async () => {
    taken = true;
    const res = await as("post", "/api/admin/users").send(BODY);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("An account with this email already exists.");
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("Supabase says the email is registered → the same 409, nothing written", async () => {
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: null, error: { status: 422, message: "User already registered" } });
    const res = await as("post", "/api/admin/users").send(BODY);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("An account with this email already exists.");
    expect(queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  });

  it("another Supabase error → 502, logged without the password or email", async () => {
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: null, error: { status: 500, code: "unexpected", message: "boom" } });
    const res = await as("post", "/api/admin/users").send(BODY);
    expect(res.status).toBe(502);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain("agency.test");
  });

  it.each([
    ["no number", "abcdefgh"],
    ["no letter", "12345678"],
    ["too short", "abc123"],
  ])("a weak password (%s) → 400, Supabase never called", async (_why, temporaryPassword) => {
    const res = await as("post", "/api/admin/users").send({ ...BODY, temporaryPassword });
    expect(res.status).toBe(400);
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/users/:id/status", () => {
  const patch = (id, accountStatus) => as("patch", `/api/admin/users/${id}/status`).send({ accountStatus });

  it("deactivates HR under the active-admin lock, then bans in Supabase", async () => {
    const res = await patch(HR_ID, "inactive");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: HR_ID, accountStatus: "inactive", signInBlocked: true });
    expect(withTransaction.mock.calls[0][0]).toBe(USER_ID);
    expect(txQueries.map((q) => q.sql.split(" ").slice(0, 2).join(" "))).toEqual(["select user_account_id", "update public.user_account"]);
    expect(txQueries[0].sql).toContain("order by user_account_id for update");
    expect(txQueries[1].params).toEqual([HR_ID, "inactive"]);
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(HR_ID, { ban_duration: "876000h" });
  });

  it("a failed ban keeps the deactivation and says signInBlocked: false", async () => {
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { status: 500, code: "x" } });
    const res = await patch(HR_ID, "inactive");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: HR_ID, accountStatus: "inactive", signInBlocked: false });
    expect(txQueries[1].params).toEqual([HR_ID, "inactive"]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("your own account → 409, nothing locked, written, or banned", async () => {
    staff = { userId: USER_ID, role: "admin", accountStatus: "active" };
    const res = await patch(USER_ID, "inactive");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("You cannot deactivate your own account.");
    expect(withTransaction).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("the last active admin → 409 (seen under the lock), nothing written or banned", async () => {
    staff = { userId: ADMIN2_ID, role: "admin", accountStatus: "active" };
    activeAdmins = [ADMIN2_ID]; // the caller was deactivated meanwhile: ADMIN2 is the only active admin left
    const res = await patch(ADMIN2_ID, "inactive");
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Keep at least one active admin.");
    expect(txQueries).toHaveLength(1);
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("another admin while two are active → allowed", async () => {
    staff = { userId: ADMIN2_ID, role: "admin", accountStatus: "active" };
    activeAdmins = [USER_ID, ADMIN2_ID];
    const res = await patch(ADMIN2_ID, "inactive");
    expect(res.status).toBe(200);
    expect(res.body.data.accountStatus).toBe("inactive");
  });

  it("activate: unban first, then the status", async () => {
    staff = { ...staff, accountStatus: "inactive" };
    const res = await patch(HR_ID, "active");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: HR_ID, accountStatus: "active", signInBlocked: false });
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(HR_ID, { ban_duration: "none" });
    const update = queries.find((q) => q.sql.startsWith("update public.user_account"));
    expect(update.params).toEqual([HR_ID, "active"]);
    expect(supabaseAdmin.auth.admin.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(
      pool.query.mock.invocationCallOrder[pool.query.mock.calls.findIndex(([sql]) => flat(sql).startsWith("update public.user_account"))],
    );
  });

  it("activate: a failed unban → 502 and the status is unchanged", async () => {
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { status: 500 } });
    const res = await patch(HR_ID, "active");
    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe("Could not unblock sign-in. Try again.");
    expect(queries.some((q) => q.sql.startsWith("update"))).toBe(false);
  });

  it("an applicant or unknown id → 404; a bad status → 400", async () => {
    staff = null;
    expect((await patch(HR_ID, "inactive")).status).toBe(404);
    expect((await patch(HR_ID, "banned")).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
