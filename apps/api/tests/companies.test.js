// Company Management (FR-COMP-01..03; TC-10, TC-20, TC-21, TC-22).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const COMPANY_ID = "55555555-5555-4555-8555-555555555555";
const KABAYAN = {
  companyId: COMPANY_ID,
  companyName: "Kabayan Mart",
  industry: "Retail",
  description: "Grocery chain in Bulacan",
  website: "https://kabayanmart.com",
  contactPersonName: "Liza Santos",
  contactPersonPosition: "HR Manager",
  contactEmail: "liza@kabayanmart.com",
  contactNumber: "0917-555-0101",
};
const FORM = {
  companyName: "Kabayan Mart",
  industry: "Retail",
  description: "Grocery chain in Bulacan",
  website: "kabayanmart.com",
  contactPersonName: "Liza Santos",
  contactPersonPosition: "HR Manager",
  contactEmail: "liza@kabayanmart.com",
  contactNumber: "0917-555-0101",
};

let role;
let queries;
let handler;

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  queries = [];
  handler = async () => ({ rows: [] });
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    queries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    return handler(sql, params);
  });
});

const as = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");

describe("access", () => {
  it("refuses applicants with 403 FORBIDDEN (TC-10)", async () => {
    role = "applicant";
    const res = await as("get", "/api/admin/companies");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it.each(["hr", "admin"])("allows %s", async (r) => {
    role = r;
    handler = async (sql) => (sql.includes("count(*)::int as total") ? { rows: [{ total: 0 }] } : { rows: [] });
    expect((await as("get", "/api/admin/companies")).status).toBe(200);
  });
});

describe("GET /api/admin/companies", () => {
  it("searches by name as a parameter and returns meta (TC-22)", async () => {
    handler = async (sql) =>
      sql.includes("count(*)::int as total")
        ? { rows: [{ total: 1 }] }
        : { rows: [{ companyId: COMPANY_ID, companyName: "Kabayan Mart", industry: "Retail", vacancyCount: 2 }] };

    const res = await as("get", "/api/admin/companies?search=kaba&page=1&pageSize=20");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ companyId: COMPANY_ID, companyName: "Kabayan Mart", industry: "Retail", vacancyCount: 2 }],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
    const list = queries.find((q) => q.sql.includes("order by lower(c.company_name)"));
    expect(list.sql).toContain("c.company_name ilike $1");
    expect(list.params).toEqual(["%kaba%", 20, 0, "archived"]);
  });

  it("matches wildcard characters literally", async () => {
    handler = async (sql) => (sql.includes("count(*)::int as total") ? { rows: [{ total: 0 }] } : { rows: [] });
    await as("get", "/api/admin/companies?search=50%25_off");
    expect(queries[0].params[0]).toBe("%50\\%\\_off%");
  });

  it("rejects a page size over 100", async () => {
    expect((await as("get", "/api/admin/companies?pageSize=500")).status).toBe(400);
  });
});

describe("POST /api/admin/companies", () => {
  beforeEach(() => {
    handler = async (sql) => {
      if (sql.includes("insert into public.company")) return { rows: [{ companyId: COMPANY_ID }] };
      if (sql.includes("from public.company c where c.company_id")) return { rows: [KABAYAN] };
      return { rows: [] };
    };
  });

  it("creates the company with every field and records who added it (TC-20)", async () => {
    const res = await as("post", "/api/admin/companies").send(FORM);

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(KABAYAN);
    const insert = queries.find((q) => q.sql.startsWith("insert into public.company"));
    expect(insert.params).toEqual([
      "Kabayan Mart", "Retail", "Grocery chain in Bulacan", "https://kabayanmart.com", "Liza Santos",
      "HR Manager", "liza@kabayanmart.com", "0917-555-0101", USER_ID,
    ]);
  });

  it("stores empty optional fields as null", async () => {
    await as("post", "/api/admin/companies").send({ ...FORM, description: "", website: "", contactPersonPosition: "", contactNumber: "" });
    const insert = queries.find((q) => q.sql.startsWith("insert into public.company"));
    expect(insert.params[2]).toBeNull();
    expect(insert.params[3]).toBeNull();
    expect(insert.params[5]).toBeNull();
    expect(insert.params[7]).toBeNull();
  });

  it("returns CONFLICT on the name field for a duplicate name (TC-21)", async () => {
    handler = async (sql) => {
      if (sql.includes("insert into public.company")) throw Object.assign(new Error("duplicate key"), { code: "23505" });
      return { rows: [] };
    };
    const res = await as("post", "/api/admin/companies").send({ ...FORM, companyName: "kabayan mart" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.details[0].path).toBe("companyName");
  });

  it.each([
    ["a missing name", { companyName: "" }, "companyName"],
    ["an invalid email", { contactEmail: "liza@" }, "contactEmail"],
    ["an invalid website", { website: "not a site" }, "website"],
    ["an invalid contact number", { contactNumber: "call Liza" }, "contactNumber"],
  ])("rejects %s", async (_label, change, path) => {
    const res = await as("post", "/api/admin/companies").send({ ...FORM, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
    expect(queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  });
});

describe("GET /api/admin/companies/:id", () => {
  it("returns the company with its five counts; statuses come from @vera/shared", async () => {
    const counts = { vacancies: 3, openVacancies: 1, inAgencyInterview: 2, awaitingClient: 1, hired: 1, endorsed: 2 };
    handler = async (sql) => (sql.includes('as "vacancies"') ? { rows: [counts] } : { rows: [KABAYAN] });

    const res = await as("get", `/api/admin/companies/${COMPANY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...KABAYAN, counts });
    const countQuery = queries.find((q) => q.sql.includes('as "vacancies"'));
    expect(countQuery.params).toEqual([
      COMPANY_ID, "archived", "open", ["interview_scheduled", "interview_confirmed"], "sent", "pending", "hired",
    ]);
  });

  it("is 404 for an unknown company", async () => {
    expect((await as("get", `/api/admin/companies/${COMPANY_ID}`)).status).toBe(404);
  });

  it("is 400 for a malformed id", async () => {
    expect((await as("get", "/api/admin/companies/abc")).status).toBe(400);
  });
});

describe("PATCH /api/admin/companies/:id", () => {
  it("updates the company", async () => {
    handler = async (sql) => {
      if (sql.includes("update public.company")) return { rowCount: 1, rows: [] };
      return { rows: [{ ...KABAYAN, industry: "Supermarket" }] };
    };
    const res = await as("patch", `/api/admin/companies/${COMPANY_ID}`).send({ ...FORM, industry: "Supermarket" });
    expect(res.status).toBe(200);
    expect(res.body.data.industry).toBe("Supermarket");
    const update = queries.find((q) => q.sql.startsWith("update public.company"));
    expect(update.params[0]).toBe(COMPANY_ID);
    expect(update.params[2]).toBe("Supermarket");
  });

  it("is 404 for an unknown company", async () => {
    handler = async () => ({ rowCount: 0, rows: [] });
    expect((await as("patch", `/api/admin/companies/${COMPANY_ID}`).send(FORM)).status).toBe(404);
  });

  it("returns CONFLICT when renaming to an existing name", async () => {
    handler = async () => {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    };
    const res = await as("patch", `/api/admin/companies/${COMPANY_ID}`).send(FORM);
    expect(res.status).toBe(409);
    expect(res.body.error.details[0].path).toBe("companyName");
  });
});
