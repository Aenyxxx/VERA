// Demo data for `pnpm --filter api seed:demo` (ROADMAP §5 demo script, docs/test-cases.md standard data).
// Kept apart from seed-demo.js so the tests can check the values and the insert-only logic without a database.
import { VACANCY_STATUS } from "@vera/shared";

import { assertTransition } from "../src/domain/vacancyStatus.js";
import { insertCompany } from "../src/modules/companies/companies.repository.js";
import { companySchema } from "../src/modules/companies/companies.schemas.js";
import { insertVacancy, replaceSectionWeights, setVacancyStatus } from "../src/modules/vacancies/vacancies.repository.js";
import { vacancySchema } from "../src/modules/vacancies/vacancies.schemas.js";

// Fictional client companies; contact details use the reserved .example domain.
export const DEMO_COMPANIES = [
  {
    companyName: "Kabayan Mart",
    industry: "Retail (grocery and supermarket)",
    description: "Neighborhood grocery and supermarket chain in Bulacan.",
    website: null,
    contactPersonName: "Kabayan Mart HR Officer",
    contactPersonPosition: "HR Officer",
    contactEmail: "hr@kabayanmart.example",
    contactNumber: null,
  },
  {
    companyName: "ClayGo",
    industry: "Food service (quick-service restaurant)",
    description: "Quick-service restaurant and convenience store in Bulacan.",
    website: null,
    contactPersonName: "ClayGo HR Officer",
    contactPersonPosition: "HR Officer",
    contactEmail: "hr@claygo.example",
    contactNumber: null,
  },
];

/**
 * Vacancy fields as the vacancy form sends them (validated with the same vacancySchema), plus the
 * company they belong to (`companyName`, one of DEMO_COMPANIES) instead of a companyId.
 */
export const DEMO_VACANCIES = [
  {
    companyName: "Kabayan Mart",
    jobTitle: "Cashier",
    jobDescription: "Handles payments at the counter and serves customers in a busy supermarket.",
    keyResponsibilities:
      "Process cash and cashless payments\nIssue receipts and give correct change\nCount and balance the cash drawer at the end of each shift\nAssist customers at the counter",
    requiredSkills:
      "Handling cash and giving correct change\nOperating a cash register or POS\nServing and assisting customers\nCounting and balancing the cash drawer",
    experienceRequirement:
      "Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers",
    minYearsExperience: 1,
    minAge: 18,
    maxAge: 35,
    genderRequirement: "any",
    minEducationLevel: "senior_high",
    minHeightCm: 150,
    deploymentLocation: "Baliuag, Bulacan",
    employmentType: "Full-time",
    slotsNeeded: 2, // shortlist 4 per group
    applicationCap: 16, // BR-02: ≥ slots × 4 = 8; default slots × 8
    endorsementCount: 3, // BR-03: ≥ slots
    matchingThreshold: 40,
    passingScore: 75,
    sectionWeights: [
      { sectionCode: "A", weight: 30 },
      { sectionCode: "B", weight: 30 },
      { sectionCode: "C", weight: 40 },
    ],
  },
  {
    companyName: "ClayGo",
    jobTitle: "Store Crew",
    jobDescription: "Keeps the store stocked, clean and organized, and helps customers during busy hours.",
    keyResponsibilities:
      "Stock and arrange items on shelves\nKeep the store and dining area clean\nAssist customers in finding items\nHelp with food preparation when needed",
    requiredSkills:
      "Stocking and arranging items on shelves\nKeeping the store clean and organized\nAssisting customers in finding items\nWorking under pressure during busy hours",
    experienceRequirement:
      "Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant",
    minYearsExperience: 0,
    minAge: 18,
    maxAge: 35,
    genderRequirement: "any",
    minEducationLevel: "senior_high",
    minHeightCm: 150,
    deploymentLocation: "Bocaue, Bulacan",
    employmentType: "Full-time",
    slotsNeeded: 1, // shortlist 2 per group
    applicationCap: 8, // BR-02: ≥ slots × 4 = 4; default slots × 8
    endorsementCount: 1, // BR-03: ≥ slots
    matchingThreshold: 40,
    passingScore: 75,
    sectionWeights: [
      { sectionCode: "A", weight: 20 },
      { sectionCode: "B", weight: 80 },
      { sectionCode: "C", weight: 0 },
    ],
  },
];

/** Existing company id (same name, case-insensitive) or a new company. Never updates an existing company. */
async function ensureCompany(client, demo, hrUserId, log) {
  const company = companySchema.parse(demo);
  const { rows } = await client.query(
    `select company_id as "companyId" from public.company where lower(company_name) = lower($1)`,
    [company.companyName],
  );
  if (rows[0]) {
    log.push(`company ${company.companyName}: exists, left unchanged`);
    return rows[0].companyId;
  }
  const companyId = await insertCompany(company, hrUserId, client);
  log.push(`company ${company.companyName}: created`);
  return companyId;
}

/**
 * Inserts the demo companies and vacancies when they are missing. Never updates an existing row:
 * an existing company (same name) is reused, and an existing vacancy (same title at that company) is left as is.
 * New vacancies are published (open) by the HR user, like HR would in the app.
 * @param {import("pg").PoolClient} client inside withTransaction(hrUserId)
 * @param {string} hrUserId user_account_id of the seeded HR account (created_by)
 * @returns {Promise<string[]>} one log line per row
 */
export async function seedDemo(client, hrUserId) {
  const log = [];

  const companyIds = {};
  for (const demo of DEMO_COMPANIES) {
    companyIds[demo.companyName] = await ensureCompany(client, demo, hrUserId, log);
  }

  for (const { companyName, ...demo } of DEMO_VACANCIES) {
    const companyId = companyIds[companyName];
    const label = `vacancy ${demo.jobTitle} (${companyName})`;
    const { rows: existing } = await client.query(
      `select 1 from public.job_vacancy where company_id = $1 and lower(job_title) = lower($2)`,
      [companyId, demo.jobTitle],
    );
    if (existing.length > 0) {
      log.push(`${label}: exists, left unchanged`);
      continue;
    }

    const fields = vacancySchema.parse({ ...demo, companyId });
    const vacancyId = await insertVacancy(client, fields, hrUserId);
    await replaceSectionWeights(client, vacancyId, fields.sectionWeights);
    await setVacancyStatus(client, vacancyId, assertTransition(VACANCY_STATUS.DRAFT, "publish"), { posted: true });
    log.push(`${label}: created and published`);
  }

  return log;
}
