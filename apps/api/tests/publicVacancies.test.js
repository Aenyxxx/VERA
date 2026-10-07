// Applicant job list (FR-VAC-04, BR-16, CLAUDE.md rule 4; TC-26).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const JOB = {
  vacancyId: VACANCY_ID,
  jobTitle: "Cashier",
  jobDescription: "Handles payments at the counter.",
  keyResponsibilities: "Process payments\nIssue receipts",
  requiredSkills: "Cash handling\nPOS system operation",
  experienceRequirement: "Cashier\nBalance the cash drawer",
  minYearsExperience: 1,
  minEducationLevel: "senior_high",
  minHeightCm: null,
  deploymentLocation: "Baliuag, Bulacan",
  employmentType: "Full-time",
  postedAt: "2026-10-07T01:00:00.000Z",
};

let role;
let queries;
let detailRows;

beforeEach(() => {
  vi.clearAllMocks();
  role = "applicant";
  queries = [];
  detailRows = [JOB];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    queries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("count(*)::int as total")) return { rows: [{ total: 1 }] };
    if (sql.includes("left(v.job_description, 200)")) {
      return { rows: [{ vacancyId: VACANCY_ID, jobTitle: "Cashier", summary: "Handles payments", deploymentLocation: "Baliuag", employmentType: "Full-time", postedAt: JOB.postedAt }] };
    }
    if (sql.includes("where v.job_vacancy_id = $1")) return { rows: detailRows };
    return { rows: [] };
  });
});

const get = (path) => request(app).get(path).set("Authorization", "Bearer t");
const COMPANY_KEY = /company/i;
const PROHIBITED = ["minAge", "maxAge", "genderRequirement"];

describe("GET /api/applicant/vacancies", () => {
  it("lists only open vacancies, searching the title", async () => {
    const res = await get("/api/applicant/vacancies?search=cash");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    const list = queries.find((q) => q.sql.includes("left(v.job_description, 200)"));
    expect(list.sql).toContain("where v.status = $1 and v.job_title ilike $2");
    expect(list.params.slice(0, 2)).toEqual(["open", "%cash%"]);
  });

  it("never exposes the company (TC-26)", async () => {
    const res = await get("/api/applicant/vacancies");
    for (const item of res.body.data) {
      expect(Object.keys(item).filter((key) => COMPANY_KEY.test(key))).toEqual([]);
    }
    for (const { sql } of queries) {
      expect(sql).not.toMatch(/company/i); // no company columns, no join
    }
  });
});

describe("GET /api/applicant/vacancies/:id", () => {
  it("returns the posting without company, age, or gender fields (TC-26, RA 10911)", async () => {
    const res = await get(`/api/applicant/vacancies/${VACANCY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(JOB);
    expect(Object.keys(res.body.data).filter((key) => COMPANY_KEY.test(key))).toEqual([]);
    for (const key of PROHIBITED) expect(res.body.data).not.toHaveProperty(key);

    const detail = queries.find((q) => q.sql.includes("where v.job_vacancy_id = $1"));
    expect(detail.sql).not.toMatch(/company|min_age|max_age|gender/i);
    expect(detail.params).toEqual([VACANCY_ID, "open"]);
  });

  it("is 404 when the vacancy is not open or does not exist", async () => {
    detailRows = [];
    const res = await get(`/api/applicant/vacancies/${VACANCY_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("This job is no longer open.");
  });

  it("is for applicants only", async () => {
    role = "hr";
    expect((await get("/api/applicant/vacancies")).status).toBe(403);
  });
});
