// In-app notifications feed (PRD FR-NOTIF-01, simplified): own rows only, unread count, mark all read.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const NOTICE = {
  notificationId: "88888888-8888-4888-8888-888888888888",
  type: "application_submitted",
  title: "Application received",
  message: "Your application for Cashier was received. You are in line for document review.",
  linkPath: "/applicant",
  requiresAction: false,
  isRead: false,
  createdAt: "2026-10-10T08:00:00.000Z",
};

let role;
let queries;

beforeEach(() => {
  vi.clearAllMocks();
  role = "applicant";
  queries = [];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    queries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes('as "unreadCount"')) return { rows: [{ unreadCount: 3 }] };
    if (sql.startsWith("update")) return { rows: [], rowCount: 3 };
    return { rows: [NOTICE] };
  });
});

const get = (path = "/api/notifications") => request(app).get(path).set("Authorization", "Bearer t");

describe("GET /api/notifications", () => {
  it("returns the signed-in user's feed with the unread count", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [NOTICE], meta: { unreadCount: 3 } });
    for (const q of queries) expect(q.params[0]).toBe(USER_ID);
    expect(queries[0].params).toEqual([USER_ID, 20]); // default limit
  });

  it("accepts a limit up to 50", async () => {
    expect((await get("/api/notifications?limit=5")).status).toBe(200);
    expect(queries[0].params).toEqual([USER_ID, 5]);
    expect((await get("/api/notifications?limit=500")).status).toBe(400);
  });

  it("works for HR and admin too (their own feed)", async () => {
    role = "hr";
    expect((await get()).status).toBe(200);
    role = "admin";
    expect((await get()).status).toBe(200);
  });

  it("requires sign-in", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("marks only the user's unread notifications as read", async () => {
    const res = await request(app).post("/api/notifications/read-all").set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 3 });
    expect(queries[0].sql).toMatch(/where user_account_id = \$1 and not is_read/);
    expect(queries[0].params).toEqual([USER_ID]);
  });
});
