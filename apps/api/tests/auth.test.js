// authenticate + GET /api/me (FR-AUTH-01, FR-AUTH-08; API part of TC-09).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const USER_ID = "11111111-1111-1111-1111-111111111111";

function givenAccount(account, hasProfile = false) {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account")) return { rows: account ? [account] : [] };
    if (sql.includes("from public.applicant")) return { rows: [{ hasProfile }] };
    throw new Error(`unexpected query: ${sql}`);
  });
}

const account = (overrides = {}) => ({
  userId: USER_ID,
  email: "applicant@vera.test",
  role: "applicant",
  fullName: null,
  accountStatus: "active",
  ...overrides,
});

const getMe = (token = "valid-token") => request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

describe("authenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request without a token", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an invalid or expired token", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid JWT") });
    const res = await getMe("bad-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a sign-in without a VERA account (email not confirmed)", async () => {
    givenAccount(null);
    const res = await getMe();
    expect(res.status).toBe(401);
  });

  it("rejects an inactive account with 403 (TC-09)", async () => {
    givenAccount(account({ role: "hr", accountStatus: "inactive" }));
    const res = await getMe();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns role and profile state for the redirect", async () => {
    givenAccount(account(), true);
    const res = await getMe();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        userId: USER_ID,
        email: "applicant@vera.test",
        role: "applicant",
        fullName: null,
        accountStatus: "active",
        hasProfile: true,
      },
    });
    expect(supabaseAdmin.auth.getUser).toHaveBeenCalledWith("valid-token");
  });

  it("reports hasProfile false for an applicant who has not confirmed a profile", async () => {
    givenAccount(account(), false);
    const res = await getMe();
    expect(res.body.data.hasProfile).toBe(false);
  });
});
