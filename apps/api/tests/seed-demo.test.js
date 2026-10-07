// pnpm seed:demo data and insert-only behavior (ROADMAP §5 step 1, docs/test-cases.md standard data, BR-02/03).
import { describe, expect, it, vi } from "vitest";

import { DEMO_COMPANIES, DEMO_VACANCIES, seedDemo } from "../scripts/demo-data.js";
import { companySchema } from "../src/modules/companies/companies.schemas.js";
import { vacancySchema, weightTotal } from "../src/modules/vacancies/vacancies.schemas.js";

const KABAYAN = "55555555-5555-4555-8555-555555555551";
const CLAYGO = "55555555-5555-4555-8555-555555555552";
const COMPANY_IDS = { "kabayan mart": KABAYAN, claygo: CLAYGO };
const HR_ID = "99999999-9999-4999-8999-999999999999";
const byTitle = (title) => DEMO_VACANCIES.find((v) => v.jobTitle === title);

/** existingCompanies / existingVacancies: lower-case names already in the database. */
function fakeClient({ existingCompanies = [], existingVacancies = [] } = {}) {
  const calls = [];
  let nextVacancy = 0;
  return {
    calls,
    query: vi.fn(async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("from public.company where")) {
        const key = params[0].toLowerCase();
        return { rows: existingCompanies.includes(key) ? [{ companyId: COMPANY_IDS[key] }] : [] };
      }
      if (sql.includes("insert into public.company")) return { rows: [{ companyId: COMPANY_IDS[params[0].toLowerCase()] }] };
      if (sql.includes("select 1 from public.job_vacancy")) {
        return { rows: existingVacancies.includes(`${params[0]}/${params[1].toLowerCase()}`) ? [{}] : [] };
      }
      if (sql.includes("insert into public.job_vacancy")) return { rows: [{ vacancyId: `vac-${(nextVacancy += 1)}` }] };
      return { rows: [], rowCount: 1 };
    }),
  };
}

describe("demo data", () => {
  it("passes the same validation as the company and vacancy forms (BR-02, BR-03, weights = 100)", () => {
    for (const c of DEMO_COMPANIES) expect(() => companySchema.parse(c)).not.toThrow();
    for (const { companyName, ...v } of DEMO_VACANCIES) {
      expect(DEMO_COMPANIES.map((c) => c.companyName)).toContain(companyName);
      expect(() => vacancySchema.parse({ ...v, companyId: "55555555-5555-4555-8555-555555555555" })).not.toThrow();
      expect(v.applicationCap).toBeGreaterThanOrEqual(v.slotsNeeded * 4);
      expect(weightTotal(v.sectionWeights)).toBe(100);
    }
  });

  it("Cashier (Kabayan Mart) matches the standard test data", () => {
    expect(byTitle("Cashier")).toMatchObject({
      companyName: "Kabayan Mart",
      minAge: 18,
      maxAge: 35,
      minHeightCm: 150,
      slotsNeeded: 2,
      applicationCap: 16,
      matchingThreshold: 40,
      passingScore: 75,
      requiredSkills:
        "Handling cash and giving correct change\nOperating a cash register or POS\nServing and assisting customers\nCounting and balancing the cash drawer",
      sectionWeights: [
        { sectionCode: "A", weight: 30 },
        { sectionCode: "B", weight: 30 },
        { sectionCode: "C", weight: 40 },
      ],
    });
  });

  it("Store Crew (ClayGo) matches the standard test data", () => {
    expect(byTitle("Store Crew")).toMatchObject({
      companyName: "ClayGo",
      minAge: 18,
      maxAge: 35,
      genderRequirement: "any",
      minEducationLevel: "senior_high",
      minHeightCm: 150,
      minYearsExperience: 0,
      slotsNeeded: 1,
      applicationCap: 8,
      endorsementCount: 1,
      matchingThreshold: 40,
      passingScore: 75,
      requiredSkills:
        "Stocking and arranging items on shelves\nKeeping the store clean and organized\nAssisting customers in finding items\nWorking under pressure during busy hours",
      experienceRequirement:
        "Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant",
      sectionWeights: [
        { sectionCode: "A", weight: 20 },
        { sectionCode: "B", weight: 80 },
        { sectionCode: "C", weight: 0 },
      ],
    });
  });
});

describe("seedDemo", () => {
  it("creates both companies and both vacancies, each under its own company, published by the HR user", async () => {
    const client = fakeClient();
    const log = await seedDemo(client, HR_ID);

    expect(log).toEqual([
      "company Kabayan Mart: created",
      "company ClayGo: created",
      "vacancy Cashier (Kabayan Mart): created and published",
      "vacancy Store Crew (ClayGo): created and published",
    ]);
    for (const c of client.calls.filter((call) => call.sql.startsWith("insert into public.company"))) {
      expect(c.params.at(-1)).toBe(HR_ID);
    }
    const vacancies = client.calls.filter((c) => c.sql.startsWith("insert into public.job_vacancy"));
    expect(vacancies.map((c) => [c.params[0], c.params[1], c.params.at(-1)])).toEqual([
      [KABAYAN, "Cashier", HR_ID],
      [CLAYGO, "Store Crew", HR_ID],
    ]);
    const published = client.calls.filter((c) => c.sql.startsWith("update public.job_vacancy set status"));
    expect(published.map((c) => c.params.slice(0, 3))).toEqual([
      ["vac-1", "open", true],
      ["vac-2", "open", true],
    ]);
  });

  it("never updates existing rows: reuses companies and skips existing vacancies", async () => {
    const client = fakeClient({
      existingCompanies: ["kabayan mart", "claygo"],
      existingVacancies: [`${KABAYAN}/cashier`],
    });
    const log = await seedDemo(client, HR_ID);

    expect(log).toEqual([
      "company Kabayan Mart: exists, left unchanged",
      "company ClayGo: exists, left unchanged",
      "vacancy Cashier (Kabayan Mart): exists, left unchanged",
      "vacancy Store Crew (ClayGo): created and published",
    ]);
    expect(client.calls.some((c) => c.sql.startsWith("insert into public.company"))).toBe(false);
    const inserted = client.calls.filter((c) => c.sql.startsWith("insert into public.job_vacancy"));
    expect(inserted.map((c) => c.params[0])).toEqual([CLAYGO]);
    // Only the new vacancy is touched: no update/delete aimed at an existing row.
    for (const w of client.calls.filter((c) => /^(update|delete)/.test(c.sql))) expect(w.params[0]).toBe("vac-1");
  });

  it("does nothing on a second run", async () => {
    const client = fakeClient({
      existingCompanies: ["kabayan mart", "claygo"],
      existingVacancies: [`${KABAYAN}/cashier`, `${CLAYGO}/store crew`],
    });
    await seedDemo(client, HR_ID);
    expect(client.calls.filter((c) => /^(insert|update|delete)/.test(c.sql))).toEqual([]);
  });
});
