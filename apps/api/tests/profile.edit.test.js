// GET / PATCH /api/applicant/profile (FR-PROF-05; TC-15) and the applicant name in /api/me.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const STORED = {
  applicantId: "a1",
  firstName: "Juan",
  middleName: null,
  lastName: "Dela Cruz",
  suffix: null,
  contactNumber: "0917-123-4567",
  birthdate: "2002-07-10",
  gender: "male",
  heightCm: 172.7,
  addressLine: "Blk 5 Lot 3",
  city: "Baliuag",
  province: "Bulacan",
  educationLevel: "senior_high",
  email: "applicant@vera.test",
};

const EDIT = {
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  suffix: "",
  contactNumber: "0917-123-4567",
  birthdate: "2002-07-10",
  gender: "male",
  heightCm: 172.7,
  addressLine: "45 Mabini St.",
  city: "Malolos",
  province: "Bulacan",
  educationLevel: "senior_high",
};

let profileRow;
let updates;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  profileRow = STORED;
  updates = [];
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account") && !sql.includes("join")) return { rows: [account()] };
    if (sql.includes("update public.applicant")) {
      updates.push({ sql, params });
      return { rowCount: profileRow ? 1 : 0, rows: [] };
    }
    if (sql.includes("join public.user_account")) return { rows: profileRow ? [profileRow] : [] };
    if (sql.includes("exists")) return { rows: [{ hasProfile: Boolean(profileRow) }] };
    if (sql.includes("concat_ws")) return { rows: profileRow ? [{ name: "Juan Dela Cruz" }] : [] };
    return { rows: [] };
  });
});

const get = () => request(app).get("/api/applicant/profile").set("Authorization", "Bearer t");
const patch = (body) => request(app).patch("/api/applicant/profile").set("Authorization", "Bearer t").send(body);

describe("GET /api/applicant/profile", () => {
  it("returns the profile with the account email", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(STORED);
  });

  it("is 404 before the profile is confirmed", async () => {
    profileRow = null;
    expect((await get()).status).toBe(404);
  });
});

describe("PATCH /api/applicant/profile (TC-15)", () => {
  it("saves the edited fields and returns the profile", async () => {
    const res = await patch(EDIT);
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    const [userId, , , , , , , , , addressLine, city] = updates[0].params;
    expect(userId).toBe(USER_ID);
    expect(addressLine).toBe("45 Mabini St.");
    expect(city).toBe("Malolos");
    expect(updates[0].params[2]).toBeNull(); // empty middle name stored as null
  });

  it("never changes the email, even if the body contains one", async () => {
    await patch({ ...EDIT, email: "new@evil.test" });
    expect(updates[0].sql).not.toMatch(/email/);
    expect(updates[0].params).not.toContain("new@evil.test");
  });

  it("validates like the setup form", async () => {
    const res = await patch({ ...EDIT, birthdate: "2999-01-01", province: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(["birthdate", "province"]);
    expect(updates).toHaveLength(0);
  });

  it("is 404 before the profile is confirmed", async () => {
    profileRow = null;
    expect((await patch(EDIT)).status).toBe(404);
  });
});

describe("GET /api/me for an applicant", () => {
  it("uses the profile name for the header", async () => {
    const res = await request(app).get("/api/me").set("Authorization", "Bearer t");
    expect(res.body.data).toMatchObject({ fullName: "Juan Dela Cruz", hasProfile: true });
  });
});
