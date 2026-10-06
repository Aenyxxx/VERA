// POST /api/applicant/resume/parse (FR-PROF-01..03; TC-11, TC-12).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, fakeQueries, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/storage.js", () => ({
  uploadFile: vi.fn(async () => {}),
  moveFile: vi.fn(async () => {}),
  removeFiles: vi.fn(async () => {}),
}));
vi.mock("../src/lib/svcClient.js", () => ({ extractResume: vi.fn() }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const storage = await import("../src/lib/storage.js");
const { extractResume } = await import("../src/lib/svcClient.js");
const { svcUnavailable, validationError } = await import("../src/lib/errors.js");
const { app } = await import("../src/app.js");

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100)]);
const EXTRACTION = {
  pageCount: 1,
  rawText: "JUAN DELA CRUZ ...",
  standardizedText: "JUAN DELA CRUZ ...",
  sections: { skills: "Cash handling", experience: "Cashier" },
  skillsText: "Cash handling",
  experienceText: "Cashier",
  yearsExperience: 2.5,
  profile: { firstName: "JUAN", lastName: "DELA CRUZ", email: "juan@resume.test", educationLevel: "senior_high" },
  warnings: [],
  extractorVersion: "1.0.0",
};

const upload = (file = PDF, name = "resume.pdf", type = "application/pdf") =>
  request(app)
    .post("/api/applicant/resume/parse")
    .set("Authorization", "Bearer token")
    .attach("resume", file, { filename: name, contentType: type });

describe("POST /api/applicant/resume/parse", () => {
  let queries;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    queries = [];
    pool.query.mockImplementation(async (sql, params) => {
      queries.push(sql);
      return fakeQueries()(sql, params);
    });
    extractResume.mockResolvedValue(EXTRACTION);
  });

  it("parses the PDF, stores a draft, and returns the pre-filled profile with the account email", async () => {
    const res = await upload();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      profile: { ...EXTRACTION.profile, email: "applicant@vera.test" },
      warnings: [],
      fileName: "resume.pdf",
      yearsExperience: 2.5,
    });
    expect(extractResume).toHaveBeenCalledWith(expect.any(Buffer), "resume.pdf");
    expect(storage.uploadFile).toHaveBeenCalledWith(
      "resumes",
      expect.stringMatching(new RegExp(`^drafts/${USER_ID}/[0-9a-f-]{36}\\.pdf$`)),
      expect.any(Buffer),
    );
    expect(extractResume.mock.invocationCallOrder[0]).toBeLessThan(storage.uploadFile.mock.invocationCallOrder[0]);
    expect(queries.some((sql) => sql.includes("insert into public.resume_draft"))).toBe(true);
  });

  it("removes the previous draft file when a new resume is parsed", async () => {
    pool.query.mockImplementation(fakeQueries({ draft: { filePath: `drafts/${USER_ID}/old.pdf` } }));
    await upload();
    expect(storage.removeFiles).toHaveBeenCalledWith("resumes", [`drafts/${USER_ID}/old.pdf`]);
  });

  it("rejects a request without a file", async () => {
    const res = await request(app).post("/api/applicant/resume/parse").set("Authorization", "Bearer token");
    expect(res.status).toBe(400);
    expect(extractResume).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF file (TC-11)", async () => {
    const res = await upload(Buffer.from("PK\u0003\u0004 docx"), "resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Only PDF files/);
    expect(extractResume).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a file named .pdf that is not a PDF", async () => {
    const res = await upload(Buffer.from("not a pdf at all"));
    expect(res.status).toBe(400);
  });

  it("rejects a PDF larger than 10 MB (TC-11)", async () => {
    const big = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    const res = await upload(big);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/10 MB/);
    expect(extractResume).not.toHaveBeenCalled();
  });

  it("passes on the svc message for a scanned PDF and saves nothing (TC-11)", async () => {
    extractResume.mockRejectedValue(validationError("This PDF has no selectable text. Upload a text-based PDF (not a scanned image)."));
    const res = await upload();
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no selectable text/);
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(queries.some((sql) => sql.includes("resume_draft") && sql.includes("insert"))).toBe(false);
  });

  it("returns 503 when the svc is down", async () => {
    extractResume.mockRejectedValue(svcUnavailable());
    const res = await upload();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SVC_UNAVAILABLE");
  });

  it("refuses when the profile is already set up", async () => {
    pool.query.mockImplementation(fakeQueries({ hasProfile: true }));
    const res = await upload();
    expect(res.status).toBe(409);
    expect(extractResume).not.toHaveBeenCalled();
  });

  it("is for applicants only", async () => {
    pool.query.mockImplementation(fakeQueries({ account: account({ role: "hr" }) }));
    const res = await upload();
    expect(res.status).toBe(403);
  });
});
