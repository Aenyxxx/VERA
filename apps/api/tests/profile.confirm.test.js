// POST /api/applicant/profile/confirm (FR-PROF-04; TC-13).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeQueries, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/storage.js", () => ({
  uploadFile: vi.fn(async () => {}),
  moveFile: vi.fn(async () => {}),
  removeFiles: vi.fn(async () => {}),
}));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const storage = await import("../src/lib/storage.js");
const { app } = await import("../src/app.js");

const DRAFT = {
  filePath: `drafts/${USER_ID}/abc.pdf`,
  originalFilename: "Juan_Resume.pdf",
  fileSizeBytes: 12345,
  extraction: {
    rawText: "raw",
    standardizedText: "std",
    sections: { skills: "Cash handling" },
    skillsText: "Cash handling",
    experienceText: "Cashier",
    yearsExperience: 2.5,
    profile: { firstName: "JUAN" },
    warnings: ["no dates found in experience (years counted as 0)"],
    extractorVersion: "1.0.0",
  },
};

const PROFILE = {
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  suffix: "Jr.",
  contactNumber: "0917-123-4567",
  birthdate: "2002-07-10",
  gender: "male",
  heightCm: 172.7,
  addressLine: "Blk 5 Lot 3, Brgy. San Jose",
  city: "Baliuag",
  province: "Bulacan",
  educationLevel: "senior_high",
};

const confirm = (body = PROFILE) =>
  request(app).post("/api/applicant/profile/confirm").set("Authorization", "Bearer token").send(body);

const txStatements = () => txClient.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, " ").trim());

describe("POST /api/applicant/profile/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    pool.query.mockImplementation(fakeQueries({ draft: DRAFT }));
    txClient.query.mockImplementation(async (sql) =>
      sql.includes("insert into public.resume ") ? { rows: [{ resumeId: "r-1" }] } : { rows: [] },
    );
  });

  it("saves applicant, resume, and extraction together and deletes the draft (TC-13)", async () => {
    const res = await confirm();

    expect(res.status).toBe(201);
    const applicantId = res.body.data.applicantId;
    expect(applicantId).toMatch(/^[0-9a-f-]{36}$/);

    expect(storage.moveFile).toHaveBeenCalledWith("resumes", DRAFT.filePath, `${applicantId}/abc.pdf`);
    expect(withTransaction).toHaveBeenCalledWith(USER_ID, expect.any(Function)); // vera.actor_id = the applicant

    const sql = txStatements();
    expect(sql[0]).toMatch(/^insert into public\.applicant/);
    expect(sql[1]).toMatch(/^insert into public\.resume \(/);
    expect(sql[2]).toMatch(/^insert into public\.resume_extraction/);
    expect(sql[3]).toMatch(/^delete from public\.resume_draft/);

    const applicantParams = txClient.query.mock.calls[0][1];
    expect(applicantParams).toEqual([
      applicantId, USER_ID, "Juan", null, "Dela Cruz", "Jr.", "0917-123-4567",
      "2002-07-10", "male", 172.7, "Blk 5 Lot 3, Brgy. San Jose", "Baliuag", "Bulacan", "senior_high",
    ]);
    const extractionParams = txClient.query.mock.calls[2][1];
    expect(extractionParams[0]).toBe("r-1");
    expect(extractionParams[3]).toEqual({ skills: "Cash handling" });
    expect(extractionParams[6]).toBe(2.5);
  });

  it("moves the file back to drafts when the transaction fails", async () => {
    withTransaction.mockRejectedValueOnce(new Error("db down"));
    const res = await confirm();

    expect(res.status).toBe(500);
    expect(storage.moveFile).toHaveBeenLastCalledWith("resumes", expect.stringMatching(/\/abc\.pdf$/), DRAFT.filePath);
  });

  it("returns 409 when a concurrent confirm already created the profile", async () => {
    withTransaction.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }));
    const res = await confirm();
    expect(res.status).toBe(409);
  });

  it("requires an uploaded resume first", async () => {
    pool.query.mockImplementation(fakeQueries({ draft: null }));
    const res = await confirm();
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "BUSINESS_RULE", message: "Upload your resume first." });
    expect(storage.moveFile).not.toHaveBeenCalled();
  });

  it("refuses when the profile already exists", async () => {
    pool.query.mockImplementation(fakeQueries({ hasProfile: true, draft: DRAFT }));
    const res = await confirm();
    expect(res.status).toBe(409);
  });

  it.each([
    ["a missing last name", { lastName: "" }, "lastName"],
    ["a future birthday", { birthdate: "2999-01-01" }, "birthdate"],
    ["an unknown gender", { gender: "other" }, "gender"],
    ["an unknown education level", { educationLevel: "phd" }, "educationLevel"],
    ["an impossible height", { heightCm: 20 }, "heightCm"],
    ["a malformed contact number", { contactNumber: "call me" }, "contactNumber"],
  ])("rejects %s", async (_label, change, field) => {
    const res = await confirm({ ...PROFILE, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
    expect(storage.moveFile).not.toHaveBeenCalled();
  });

  it("accepts optional fields left empty", async () => {
    const res = await confirm({ ...PROFILE, middleName: null, suffix: "", contactNumber: "", heightCm: null });
    expect(res.status).toBe(201);
  });
});
