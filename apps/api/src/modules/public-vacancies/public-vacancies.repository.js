// Applicant-facing vacancy queries.
//
// What applicants may see is an explicit allow-list of columns:
// - Never the client company (CLAUDE.md rule 4, PRD FR-VAC-04 / BR-16): no company columns, no join to company.
// - Never the age range or gender requirement: RA 10911 (Anti-Age Discrimination in Employment Act) prohibits
//   job notices that state age preferences, and gender preferences raise similar anti-discrimination concerns.
//   Both are still enforced at apply time (prescreen, S11) and named in the prescreen_failed notification.
import { pool } from "../../db/pool.js";

const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Open vacancies by title, newest first. `openStatus` comes from @vera/shared. */
export async function listOpenVacancies({ search, page, pageSize, openStatus }, db = pool) {
  const pattern = `%${escapeLike(search)}%`;
  const [{ rows }, { rows: totals }] = await Promise.all([
    db.query(
      `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle",
              left(v.job_description, 200) as "summary",
              v.deployment_location as "deploymentLocation", v.employment_type as "employmentType",
              v.posted_at as "postedAt"
         from public.job_vacancy v
        where v.status = $1 and v.job_title ilike $2
        order by v.posted_at desc nulls last, v.job_title
        limit $3 offset $4`,
      [openStatus, pattern, pageSize, (page - 1) * pageSize],
    ),
    db.query(`select count(*)::int as total from public.job_vacancy v where v.status = $1 and v.job_title ilike $2`, [
      openStatus,
      pattern,
    ]),
  ]);
  return { rows, total: totals[0].total };
}

/** One open vacancy for the job detail page, or null (not open / unknown). */
export async function findOpenVacancy(vacancyId, openStatus, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", v.job_description as "jobDescription",
            v.key_responsibilities as "keyResponsibilities", v.required_skills as "requiredSkills",
            v.experience_requirement as "experienceRequirement", v.min_years_experience as "minYearsExperience",
            v.min_education_level as "minEducationLevel", v.min_height_cm::float as "minHeightCm",
            v.deployment_location as "deploymentLocation", v.employment_type as "employmentType",
            v.posted_at as "postedAt"
       from public.job_vacancy v
      where v.job_vacancy_id = $1 and v.status = $2`,
    [vacancyId, openStatus],
  );
  return rows[0] ?? null;
}
