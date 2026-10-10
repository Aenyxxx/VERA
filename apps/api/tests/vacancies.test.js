// Vacancies (FR-VAC-01/03/05, BR-01..03; TC-23, TC-24, TC-25), section weights (S9b), and the rubric list.
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
const COMPANY_ID = "55555555-5555-4555-8555-555555555555";
const ITEM = "77777777-7777-4777-8777-777777777771";

// docs/test-cases.md standard data: Cashier at Kabayan Mart
const CASHIER = {
  companyId: COMPANY_ID,
  jobTitle: "Cashier",
  jobDescription: "Handles payments at the counter.",
  keyResponsibilities: "Process payments\nIssue receipts",
  requiredSkills: "Cash handling\nPOS system operation\nCustomer service\nIssuing receipts",
  experienceRequirement: "Cashier\nProcess cash and cashless payments\nBalance the cash drawer",
  minYearsExperience: 1,
  minAge: 18,
  maxAge: 35,
  genderRequirement: "any",
  minEducationLevel: "senior_high",
  minHeightCm: null,
  deploymentLocation: "Baliuag, Bulacan",
  employmentType: "Full-time",
  slotsNeeded: 2,
  applicationCap: 16,
  endorsementCount: 3,
  matchingThreshold: 40,
  passingScore: 75,
  // Section weights A 30 / B 30 / C 40 (docs/ALGORITHM.md §6)
  sectionWeights: [
    { sectionCode: "A", weight: 30 },
    { sectionCode: "B", weight: 30 },
    { sectionCode: "C", weight: 40 },
  ],
};

let role;
let locked; // row returned by "for update"
let weights; // sectionWeightTotal result
let poolQueries;
let endorsed; // endorsed applications of the vacancy (archive guard)

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  locked = { status: "draft", slotsNeeded: 2, applicationCap: 16, applicationCount: 0 };
  weights = { total: 100, count: 3 };
  poolQueries = [];
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    poolQueries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("from public.system_setting")) {
      return { rows: [{ key: "default_matching_threshold", value: 40 }, { key: "default_cap_multiplier", value: 8 }] };
    }
    if (sql.includes("join public.competency c on c.section_id")) {
      return {
        rows: [
          { sectionCode: "A", sectionName: "Communication and Interpersonal Skills", competencyId: ITEM, competencyName: "Oral Communication/Listening" },
          { sectionCode: "A", sectionName: "Communication and Interpersonal Skills", competencyId: "i2", competencyName: "Customer Relations" },
          { sectionCode: "C", sectionName: "Job Specific Skills and Experience", competencyId: "i3", competencyName: "Technical Skills" },
        ],
      };
    }
    if (sql.includes("left join public.job_section_weight w")) {
      return {
        rows: CASHIER.sectionWeights.map((w) => ({ ...w, sectionName: `Section ${w.sectionCode}`, items: ["x"] })),
      };
    }
    if (sql.includes('as "applicationCount"') && sql.includes("where v.job_vacancy_id = $1")) {
      return { rows: [{ vacancyId: VACANCY_ID, ...CASHIER, status: locked.status, companyName: "Kabayan Mart" }] };
    }
    if (sql.includes("count(*)::int as total")) return { rows: [{ total: 1 }] };
    if (sql.includes("group by v.job_vacancy_id")) {
      return {
        rows: [
          {
            vacancyId: VACANCY_ID, jobTitle: "Cashier", companyName: "Kabayan Mart", status: "open", slotsNeeded: 2,
            applicationCap: 16, total: 9, screening: 4, interview: 2, passed: 1, hired: 1,
          },
        ],
      };
    }
    return { rows: [] };
  });
  endorsed = 0;
  txClient.query.mockImplementation(async (sql) => {
    if (sql.includes('as "endorsed"')) return { rows: [{ endorsed }] }; // S15 archive guard (domain/closeOut.js)
    if (sql.includes("for update")) return { rows: locked ? [locked] : [] };
    if (sql.includes("insert into public.job_vacancy")) return { rows: [{ vacancyId: VACANCY_ID }] };
    if (sql.includes("coalesce(sum(weight), 0)")) return { rows: [weights] };
    return { rows: [] };
  });
});

const as = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const txSql = () => txClient.query.mock.calls.map(([sql, params]) => ({ sql: sql.replace(/\s+/g, " ").trim(), params }));

describe("GET lists", () => {
  it("lists vacancies with remaining slots and stage counts (FR-VAC-05)", async () => {
    const res = await as("get", "/api/admin/vacancies?search=kaba&status=open");
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      jobTitle: "Cashier",
      companyName: "Kabayan Mart",
      hiredCount: 1,
      remainingSlots: 1,
      counts: { total: 9, screening: 4, interview: 2, passed: 1, hired: 1 },
    });
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    const list = poolQueries.find((q) => q.sql.includes("group by v.job_vacancy_id"));
    expect(list.sql).toContain("(v.job_title ilike $1 or c.company_name ilike $1)");
    expect(list.params.slice(0, 2)).toEqual(["%kaba%", "open"]);
    expect(list.params[4]).toEqual(["waiting_pool", "shortlisted"]);
    expect(list.params[7]).toEqual(["hired"]);
  });

  it("returns the rubric grouped by section, and the defaults from system_setting", async () => {
    expect((await as("get", "/api/admin/competencies")).body.data).toEqual([
      {
        sectionCode: "A",
        sectionName: "Communication and Interpersonal Skills",
        items: [
          { competencyId: ITEM, competencyName: "Oral Communication/Listening" },
          { competencyId: "i2", competencyName: "Customer Relations" },
        ],
      },
      {
        sectionCode: "C",
        sectionName: "Job Specific Skills and Experience",
        items: [{ competencyId: "i3", competencyName: "Technical Skills" }],
      },
    ]);
    expect((await as("get", "/api/admin/vacancies/defaults")).body.data).toEqual({ matchingThreshold: 40, capMultiplier: 8 });
  });

  it("refuses applicants (TC-10)", async () => {
    role = "applicant";
    expect((await as("get", "/api/admin/vacancies")).status).toBe(403);
  });
});

describe("POST /api/admin/vacancies", () => {
  it("creates a draft and its weights in one transaction", async () => {
    const res = await as("post", "/api/admin/vacancies").send(CASHIER);

    expect(res.status).toBe(201);
    expect(withTransaction).toHaveBeenCalledWith(USER_ID, expect.any(Function));
    const sql = txSql();
    expect(sql[0].sql).toMatch(/^insert into public\.job_vacancy/);
    expect(sql[0].params.at(-1)).toBe(USER_ID); // created_by
    expect(sql[1].sql).toMatch(/^delete from public\.job_section_weight/);
    const inserts = sql.filter((q) => q.sql.startsWith("insert into public.job_section_weight"));
    expect(inserts.map((q) => q.params)).toEqual([
      [VACANCY_ID, "A", 30],
      [VACANCY_ID, "B", 30],
      [VACANCY_ID, "C", 40],
    ]);
    expect(res.body.data).toMatchObject({ jobTitle: "Cashier", weightTotal: 100, editable: { full: true } });
  });

  it("allows a draft without weights yet", async () => {
    expect((await as("post", "/api/admin/vacancies").send({ ...CASHIER, sectionWeights: [] })).status).toBe(201);
    expect(txSql().some((q) => q.sql.startsWith("insert into public.job_section_weight"))).toBe(false);
  });

  it("rejects section weights that do not total 100 (TC-23)", async () => {
    const res = await as("post", "/api/admin/vacancies").send({
      ...CASHIER,
      sectionWeights: [
        { sectionCode: "A", weight: 30 },
        { sectionCode: "B", weight: 40 },
        { sectionCode: "C", weight: 20 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: "sectionWeights", message: "Weights must total 100%; now 90%" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["a cap below slots × 4 (TC-24)", { applicationCap: 6 }, "applicationCap", "Application cap must be at least 8 (slots × 4)"],
    ["an endorsement count below slots", { endorsementCount: 1 }, "endorsementCount", "Endorsement count must be at least 2 (the number of slots)"],
    ["a maximum age below the minimum", { minAge: 30, maxAge: 20 }, "maxAge", "Maximum age must be at least the minimum age"],
    ["a passing score over 100", { passingScore: 120 }, "passingScore", "Use 0–100"],
  ])("rejects %s", async (_label, change, path, message) => {
    const res = await as("post", "/api/admin/vacancies").send({ ...CASHIER, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path, message });
  });

  it("allows a section at 0% and stores missing sections as 0", async () => {
    const res = await as("post", "/api/admin/vacancies").send({
      ...CASHIER,
      sectionWeights: [
        { sectionCode: "A", weight: 60 },
        { sectionCode: "C", weight: 40 },
      ],
    });
    expect(res.status).toBe(201);
    const inserts = txSql().filter((q) => q.sql.startsWith("insert into public.job_section_weight"));
    expect(inserts.map((q) => q.params.slice(1))).toEqual([
      ["A", 60],
      ["B", 0],
      ["C", 40],
    ]);
  });

  it.each([
    ["a section weighted twice", [{ sectionCode: "A", weight: 50 }, { sectionCode: "A", weight: 50 }]],
    ["an unknown section", [{ sectionCode: "D", weight: 100 }]],
    ["a negative weight", [{ sectionCode: "A", weight: -10 }, { sectionCode: "B", weight: 110 }]],
  ])("rejects %s", async (_label, sectionWeights) => {
    expect((await as("post", "/api/admin/vacancies").send({ ...CASHIER, sectionWeights })).status).toBe(400);
  });

  it("returns the section weights with their items", async () => {
    const res = await as("post", "/api/admin/vacancies").send(CASHIER);
    expect(res.body.data.sectionWeights).toEqual([
      { sectionCode: "A", sectionName: "Section A", weight: 30, items: ["x"] },
      { sectionCode: "B", sectionName: "Section B", weight: 30, items: ["x"] },
      { sectionCode: "C", sectionName: "Section C", weight: 40, items: ["x"] },
    ]);
  });
});

describe("status actions", () => {
  it("publishes a draft whose weights total 100 (TC-25)", async () => {
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/publish`);
    expect(res.status).toBe(200);
    const update = txSql().find((q) => q.sql.startsWith("update public.job_vacancy set status"));
    expect(update.params).toEqual([VACANCY_ID, "open", true, false]);
  });

  it("refuses to publish without weights totalling 100", async () => {
    weights = { total: 0, count: 0 };
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/must total 100%/);
  });

  it("refuses to publish an open vacancy (409)", async () => {
    locked.status = "open";
    expect((await as("post", `/api/admin/vacancies/${VACANCY_ID}/publish`)).status).toBe(409);
  });

  it("closes an open vacancy with closed_at", async () => {
    locked.status = "open";
    await as("post", `/api/admin/vacancies/${VACANCY_ID}/close`);
    const update = txSql().find((q) => q.sql.startsWith("update public.job_vacancy set status"));
    expect(update.params).toEqual([VACANCY_ID, "closed", false, true]);
  });

  it("refuses to reopen when applications reached the cap (FR-VAC-07)", async () => {
    locked = { status: "closed", slotsNeeded: 2, applicationCap: 16, applicationCount: 16 };
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/reopen`);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Raise the application cap to reopen/);
  });

  it("counts only qualified applications toward the cap (prescreen failed / below threshold excluded)", async () => {
    const { lockVacancy, findVacancy } = await import("../src/modules/vacancies/vacancies.repository.js");
    const client = { query: vi.fn().mockResolvedValue({ rows: [locked] }) };
    await lockVacancy(client, VACANCY_ID);
    await findVacancy(VACANCY_ID, client);
    for (const [sql, params] of client.query.mock.calls) {
      expect(sql).toMatch(/a\.status <> all\(\$2::public\.application_status\[\]\)/);
      expect(params).toEqual([VACANCY_ID, ["prescreen_failed", "below_threshold"]]);
    }
  });

  it("raises the cap and reopens in one step", async () => {
    locked = { status: "closed", slotsNeeded: 2, applicationCap: 16, applicationCount: 16 };
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/reopen`).send({ applicationCap: 20 });
    expect(res.status).toBe(200);
    const sql = txSql();
    expect(sql.find((q) => q.sql.startsWith("update public.job_vacancy set application_cap")).params).toEqual([VACANCY_ID, 20]);
    expect(sql.find((q) => q.sql.startsWith("update public.job_vacancy set status")).params[1]).toBe("open");
  });

  it("never lowers the cap when reopening", async () => {
    locked = { status: "closed", slotsNeeded: 2, applicationCap: 16, applicationCount: 3 };
    expect((await as("post", `/api/admin/vacancies/${VACANCY_ID}/reopen`).send({ applicationCap: 10 })).status).toBe(422);
  });

  it("archives a closed vacancy but not an open one", async () => {
    locked.status = "closed";
    expect((await as("post", `/api/admin/vacancies/${VACANCY_ID}/archive`)).status).toBe(200);
    locked.status = "open";
    expect((await as("post", `/api/admin/vacancies/${VACANCY_ID}/archive`)).status).toBe(409);
  });

  it("archive closes out in the same transaction and reports the counts (BR-22, S15)", async () => {
    locked.status = "closed";
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.data.closeOut).toEqual({ notSelected: 0, standby: 0 });
    const sql = txSql().map((q) => q.sql);
    const statusUpdate = sql.findIndex((q) => q.startsWith("update public.job_vacancy set status"));
    const closeOutRead = sql.findIndex((q) => q.includes("status = any($2::public.application_status[]) order by application_id"));
    expect(statusUpdate).toBeGreaterThan(-1);
    expect(closeOutRead).toBeGreaterThan(statusUpdate);
    expect(sql[0]).toMatch(/from public\.job_vacancy v where v\.job_vacancy_id = \$1 for update/); // vacancy lock first
  });

  it("archive is refused (409) while an endorsed applicant waits for the client's decision", async () => {
    locked.status = "closed";
    endorsed = 1;
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/archive`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Record the client's decision for every endorsed applicant before archiving this vacancy.");
    expect(txSql().find((q) => q.sql.startsWith("update public.job_vacancy set status"))).toBeUndefined();
  });

  it("close (HR pause or cap) never closes out: the waiting pool is kept (BR-22)", async () => {
    locked.status = "open";
    const res = await as("post", `/api/admin/vacancies/${VACANCY_ID}/close`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("closeOut");
    const sql = txSql().map((q) => q.sql);
    expect(sql.some((q) => q.startsWith("update public.job_vacancy set status"))).toBe(true);
    expect(sql.some((q) => q.includes('as "endorsed"') || q.includes("public.application_status[]) order by application_id"))).toBe(false);
  });

  it("is 404 for an unknown vacancy", async () => {
    locked = null;
    expect((await as("post", `/api/admin/vacancies/${VACANCY_ID}/close`)).status).toBe(404);
  });
});

describe("PATCH /api/admin/vacancies/:id", () => {
  const POSTING = {
    jobTitle: "Cashier (Baliuag branch)",
    jobDescription: "Handles payments.",
    keyResponsibilities: "Process payments",
    deploymentLocation: "Baliuag",
    employmentType: "Full-time",
    applicationCap: 16,
  };

  it("edits everything while the vacancy is a draft", async () => {
    const res = await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send({ ...CASHIER, passingScore: 80 });
    expect(res.status).toBe(200);
    const update = txSql().find((q) => q.sql.startsWith("update public.job_vacancy set company_id"));
    expect(update.params.at(-1)).toBe(80);
  });

  it("edits the posting text of an open vacancy", async () => {
    locked.status = "open";
    const res = await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send(POSTING);
    expect(res.status).toBe(200);
    expect(txSql().some((q) => q.sql.startsWith("update public.job_vacancy set job_title"))).toBe(true);
    expect(txSql().some((q) => q.sql.includes("job_section_weight"))).toBe(false);
  });

  it("refuses locked fields after publishing", async () => {
    locked.status = "open";
    const res = await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send({ ...POSTING, passingScore: 60 });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ path: "passingScore", message: "Locked after publishing" }]);
  });

  it("raises but never lowers the cap of a published vacancy", async () => {
    locked.status = "closed";
    expect((await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send({ ...POSTING, applicationCap: 24 })).status).toBe(200);
    expect((await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send({ ...POSTING, applicationCap: 12 })).status).toBe(422);
  });

  it("refuses edits to a filled or archived vacancy", async () => {
    locked.status = "archived";
    expect((await as("patch", `/api/admin/vacancies/${VACANCY_ID}`).send(POSTING)).status).toBe(409);
  });
});
