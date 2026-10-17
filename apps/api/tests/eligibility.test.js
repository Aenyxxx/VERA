// Company block (PRD BR-19, decision 5, Oct 13, 2026): a failed application blocks the company's vacancies for 1 year
// from the failed outcome. ONE SQL fragment (domain/eligibility.js → atFailedCompany) used by apply, the job list and
// detail, the rematch scan, and the rematch accept re-check.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));

const { pool } = await import("../src/db/pool.js");
const { atFailedCompany, COMPANY_BLOCK_YEARS, FAILED_STATUSES, notAtFailedCompany } = await import("../src/domain/eligibility.js");
const { isAtFailedCompany } = await import("../src/modules/applications/applications.repository.js");
const { listRematchVacancies } = await import("../src/modules/rematch/rematch.repository.js");
const { findOpenVacancy, listOpenVacancies } = await import("../src/modules/public-vacancies/public-vacancies.repository.js");

const WINDOW = "fa.status_changed_at > now() - make_interval(years => 1)";
const flat = (sql) => sql.replace(/\s+/g, " ").trim();
const USER = "11111111-1111-4111-8111-111111111111";

let queries;
beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  pool.query.mockImplementation(async (sql, params) => {
    queries.push({ sql: flat(sql), params });
    return { rows: sql.includes("count(*)::int as total") ? [{ total: 0 }] : [] };
  });
});

describe("atFailedCompany (BR-19, decision 5)", () => {
  it("blocks for a fixed 1 year from the failed outcome (status_changed_at; failed statuses are final)", () => {
    expect(COMPANY_BLOCK_YEARS).toBe(1);
    const sql = flat(atFailedCompany("$5", "$6"));
    expect(sql).toContain("where fp.user_account_id = $5");
    expect(sql).toContain("and fv.company_id = v.company_id");
    expect(sql).toContain("and fa.status = any($6::public.application_status[])");
    expect(sql).toContain(`and ${WINDOW})`);
    expect(sql.startsWith("exists (")).toBe(true);
  });

  it("the failed statuses are exactly the BR-19 list", () => {
    expect(FAILED_STATUSES).toEqual(["did_not_pass", "not_hired", "training_failed", "dropped"]);
  });

  it("notAtFailedCompany is the same rule negated", () => {
    expect(notAtFailedCompany("$3", "$4")).toBe(`not ${atFailedCompany("$3", "$4")}`);
  });
});

describe("every caller uses the 1-year rule", () => {
  it("apply eligibility (pre-check and under-lock re-check): isAtFailedCompany", async () => {
    await isAtFailedCompany("v-1", USER);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain(WINDOW);
    expect(queries[0].params).toEqual(["v-1", USER, FAILED_STATUSES]);
  });

  it("rematch scan: listRematchVacancies", async () => {
    await listRematchVacancies({ applicantId: "a-1", userId: USER, talentPoolId: "tp-1" });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain(`and not exists ( select 1 from public.application fa`);
    expect(queries[0].sql).toContain(WINDOW);
    expect(queries[0].sql).not.toMatch(/min_years/); // decision 11
  });

  it("applicant job list and count, and job detail", async () => {
    await listOpenVacancies({ search: "", page: 1, pageSize: 20, openStatus: "open", userId: USER });
    await findOpenVacancy("v-1", "open", USER);
    expect(queries).toHaveLength(3);
    for (const { sql } of queries) {
      expect(sql).toContain("not exists ( select 1 from public.application fa");
      expect(sql).toContain(WINDOW);
    }
  });
});
