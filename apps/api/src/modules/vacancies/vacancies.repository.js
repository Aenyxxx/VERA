// SQL for vacancies. Functions that write take the transaction client first.
import { APPLICATION_STATUS as A } from "@vera/shared";

import { pool } from "../../db/pool.js";

// The application cap counts qualified applications only: rejected ones (prescreen failed, below threshold)
// never use it up (PRD FR-APP-07, decided Oct 7, 2026). Same count for apply (S11) and reopen (FR-VAC-07).
export const NOT_COUNTED_FOR_CAP = [A.PRESCREEN_FAILED, A.BELOW_THRESHOLD];
const QUALIFIED_COUNT = `(select count(*)::int from public.application a
                           where a.job_vacancy_id = v.job_vacancy_id
                             and a.status <> all($2::public.application_status[]))`;

const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

const VACANCY_COLUMNS = `
  v.job_vacancy_id as "vacancyId", v.company_id as "companyId", c.company_name as "companyName",
  v.job_title as "jobTitle", v.job_description as "jobDescription",
  v.key_responsibilities as "keyResponsibilities", v.required_skills as "requiredSkills",
  v.experience_requirement as "experienceRequirement", v.min_years_experience as "minYearsExperience",
  v.min_age as "minAge", v.max_age as "maxAge", v.gender_requirement as "genderRequirement",
  v.min_education_level as "minEducationLevel", v.min_height_cm::float as "minHeightCm",
  v.deployment_location as "deploymentLocation", v.employment_type as "employmentType",
  v.slots_needed as "slotsNeeded", v.shortlist_per_group as "shortlistPerGroup",
  v.application_cap as "applicationCap", v.endorsement_count as "endorsementCount",
  v.matching_threshold::float as "matchingThreshold", v.passing_score::float as "passingScore",
  v.status, v.posted_at as "postedAt", v.closed_at as "closedAt", v.created_at as "createdAt",
  v.updated_at as "updatedAt"`;

/** system_setting values used as form defaults (rule 10: settings live in the DB, not in code). */
export async function findVacancyDefaults(db = pool) {
  const { rows } = await db.query(
    `select setting_key as "key", setting_value as "value"
       from public.system_setting
      where setting_key in ('default_matching_threshold', 'default_cap_multiplier')`,
  );
  const value = (key, fallback) => Number(rows.find((r) => r.key === key)?.value ?? fallback);
  return { matchingThreshold: value("default_matching_threshold", 40), capMultiplier: value("default_cap_multiplier", 8) };
}

/**
 * FR-VAC-05 list: search on title or company, optional status, newest first, with applicant counts per stage.
 * @param {{ search: string, status?: string, page: number, pageSize: number, stages: Record<string, string[]> }} q
 */
export async function listVacancies({ search, status, page, pageSize, stages }, db = pool) {
  const pattern = `%${escapeLike(search)}%`;
  const params = [pattern, status ?? null, pageSize, (page - 1) * pageSize, stages.screening, stages.interview, stages.passed, stages.hired];
  const [{ rows }, { rows: totals }] = await Promise.all([
    db.query(
      `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", v.company_id as "companyId",
              c.company_name as "companyName", v.status, v.slots_needed as "slotsNeeded",
              v.application_cap as "applicationCap", v.posted_at as "postedAt", v.updated_at as "updatedAt",
              count(a.application_id)::int as "total",
              (count(a.application_id) filter (where a.status = any($5::public.application_status[])))::int as "screening",
              (count(a.application_id) filter (where a.status = any($6::public.application_status[])))::int as "interview",
              (count(a.application_id) filter (where a.status = any($7::public.application_status[])))::int as "passed",
              (count(a.application_id) filter (where a.status = any($8::public.application_status[])))::int as "hired"
         from public.job_vacancy v
         join public.company c on c.company_id = v.company_id
         left join public.application a on a.job_vacancy_id = v.job_vacancy_id
        where (v.job_title ilike $1 or c.company_name ilike $1)
          and ($2::public.vacancy_status is null or v.status = $2)
        group by v.job_vacancy_id, c.company_name
        order by v.updated_at desc
        limit $3 offset $4`,
      params,
    ),
    db.query(
      `select count(*)::int as total
         from public.job_vacancy v
         join public.company c on c.company_id = v.company_id
        where (v.job_title ilike $1 or c.company_name ilike $1)
          and ($2::public.vacancy_status is null or v.status = $2)`,
      [pattern, status ?? null],
    ),
  ]);
  return { rows, total: totals[0].total };
}

export async function findVacancy(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select ${VACANCY_COLUMNS},
            ${QUALIFIED_COUNT} as "applicationCount"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
      where v.job_vacancy_id = $1`,
    [vacancyId, NOT_COUNTED_FOR_CAP],
  );
  return rows[0] ?? null;
}

/** Every Competency Profile section with its items and this vacancy's weight (null when not set yet). */
export async function findVacancySectionWeights(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select s.section_code as "sectionCode", s.section_name as "sectionName", w.weight::float as "weight",
            coalesce(
              (select array_agg(c.competency_name order by c.sort_order)
                 from public.competency c
                where c.section_id = s.competency_section_id and c.is_active),
              '{}'
            ) as "items"
       from public.competency_section s
       left join public.job_section_weight w
         on w.competency_section_id = s.competency_section_id and w.job_vacancy_id = $1
      order by s.sort_order`,
    [vacancyId],
  );
  return rows;
}

/** Row lock for status changes, edits, and applying (the shortlist refresh locks the same row). */
export async function lockVacancy(client, vacancyId) {
  const { rows } = await client.query(
    `select status, slots_needed as "slotsNeeded", application_cap as "applicationCap",
            ${QUALIFIED_COUNT} as "applicationCount"
       from public.job_vacancy v
      where v.job_vacancy_id = $1
      for update`,
    [vacancyId, NOT_COUNTED_FOR_CAP],
  );
  return rows[0] ?? null;
}

const FULL_PARAMS = (v) => [
  v.companyId, v.jobTitle, v.jobDescription, v.keyResponsibilities, v.requiredSkills, v.experienceRequirement,
  v.minYearsExperience, v.minAge, v.maxAge, v.genderRequirement, v.minEducationLevel, v.minHeightCm,
  v.deploymentLocation, v.employmentType, v.slotsNeeded, v.applicationCap, v.endorsementCount,
  v.matchingThreshold, v.passingScore,
];

/** New vacancies always start as drafts (status default). Returns job_vacancy_id. */
export async function insertVacancy(client, v, createdBy) {
  const { rows } = await client.query(
    `insert into public.job_vacancy
       (company_id, job_title, job_description, key_responsibilities, required_skills, experience_requirement,
        min_years_experience, min_age, max_age, gender_requirement, min_education_level, min_height_cm,
        deployment_location, employment_type, slots_needed, application_cap, endorsement_count,
        matching_threshold, passing_score, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     returning job_vacancy_id as "vacancyId"`,
    [...FULL_PARAMS(v), createdBy],
  );
  return rows[0].vacancyId;
}

/** Draft edit: every field. */
export async function updateVacancyFull(client, vacancyId, v) {
  await client.query(
    `update public.job_vacancy
        set company_id = $2, job_title = $3, job_description = $4, key_responsibilities = $5,
            required_skills = $6, experience_requirement = $7, min_years_experience = $8, min_age = $9,
            max_age = $10, gender_requirement = $11, min_education_level = $12, min_height_cm = $13,
            deployment_location = $14, employment_type = $15, slots_needed = $16, application_cap = $17,
            endorsement_count = $18, matching_threshold = $19, passing_score = $20
      where job_vacancy_id = $1`,
    [vacancyId, ...FULL_PARAMS(v)],
  );
}

/** Published edit: posting text and the application cap only (PRD FR-VAC-03). */
export async function updatePostingText(client, vacancyId, v) {
  await client.query(
    `update public.job_vacancy
        set job_title = $2, job_description = $3, key_responsibilities = $4, deployment_location = $5,
            employment_type = $6, application_cap = $7
      where job_vacancy_id = $1`,
    [vacancyId, v.jobTitle, v.jobDescription, v.keyResponsibilities, v.deploymentLocation, v.employmentType, v.applicationCap],
  );
}

/** Replace the section weights; the deferred trigger checks total = 0 or 100 at commit. */
export async function replaceSectionWeights(client, vacancyId, sectionWeights) {
  await client.query("delete from public.job_section_weight where job_vacancy_id = $1", [vacancyId]);
  for (const { sectionCode, weight } of sectionWeights) {
    await client.query(
      `insert into public.job_section_weight (job_vacancy_id, competency_section_id, weight)
       select $1, competency_section_id, $3 from public.competency_section where section_code = $2`,
      [vacancyId, sectionCode, weight],
    );
  }
}

export async function sectionWeightTotal(client, vacancyId) {
  const { rows } = await client.query(
    `select coalesce(sum(weight), 0)::float as "total", count(*)::int as "count"
       from public.job_section_weight where job_vacancy_id = $1`,
    [vacancyId],
  );
  return rows[0];
}

export async function setApplicationCap(client, vacancyId, applicationCap) {
  await client.query("update public.job_vacancy set application_cap = $2 where job_vacancy_id = $1", [vacancyId, applicationCap]);
}

/** Status change with its timestamp: posted_at on first publish, closed_at on close. */
export async function setVacancyStatus(client, vacancyId, status, { posted = false, closed = false } = {}) {
  await client.query(
    `update public.job_vacancy
        set status = $2,
            posted_at = case when $3 then coalesce(posted_at, now()) else posted_at end,
            closed_at = case when $4 then now() else closed_at end
      where job_vacancy_id = $1`,
    [vacancyId, status, posted, closed],
  );
}
