// SQL for applying and the applicant's status panel. Functions that write take the transaction client first.
import { APPLICATION_STATUS, INTERVIEW_STATUS, REQUEST_STATUS } from "@vera/shared";

import { pool } from "../../db/pool.js";
import { atFailedCompany, BLOCKS_APPLYING_STATUSES, FAILED_STATUSES } from "../../domain/eligibility.js";

/** Profile fields for prescreen + the current resume and its stored extraction, or null before setup. */
export async function findApplicantForApply(userId, db = pool) {
  const { rows } = await db.query(
    `select p.applicant_id as "applicantId", p.age, p.gender, p.education_level as "educationLevel",
            p.height_cm::float as "heightCm", r.resume_id as "resumeId", x.sections
       from public.v_applicant_profile p
       left join public.resume r on r.applicant_id = p.applicant_id and r.is_current
       left join public.resume_extraction x on x.resume_id = r.resume_id
      where p.user_account_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** Matching inputs, prescreen conditions and threshold. Internal only: never returned to the applicant. */
export async function findVacancyForApply(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select v.job_title as "jobTitle", v.status, v.required_skills as "requiredSkills",
            v.experience_requirement as "experienceRequirement", v.min_years_experience as "minYearsExperience",
            v.min_age as "minAge", v.max_age as "maxAge", v.gender_requirement as "genderRequirement",
            v.min_education_level as "minEducationLevel", v.min_height_cm::float as "minHeightCm",
            v.matching_threshold::float as "matchingThreshold"
       from public.job_vacancy v
      where v.job_vacancy_id = $1`,
    [vacancyId],
  );
  return rows[0] ?? null;
}

/** True when the vacancy belongs to a company where this user has a failed application (BR-19). */
export async function isAtFailedCompany(vacancyId, userId, db = pool) {
  const { rows } = await db.query(
    `select ${atFailedCompany("$2", "$3")} as "blocked"
       from public.job_vacancy v
      where v.job_vacancy_id = $1`,
    [vacancyId, userId, FAILED_STATUSES],
  );
  return rows[0]?.blocked ?? false;
}

/** The applicant's ongoing or hired application (BR-17), or null. Job title only: never the company. */
export async function findBlockingApplication(applicantId, db = pool) {
  const { rows } = await db.query(
    `select a.status, v.job_title as "jobTitle"
       from public.application a
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where a.applicant_id = $1 and a.status = any($2::public.application_status[])
      limit 1`,
    [applicantId, BLOCKS_APPLYING_STATUSES],
  );
  return rows[0] ?? null;
}

/**
 * Serializes applies of one applicant (two tabs, double click) so BR-17 and BR-19 are checked under a lock.
 * Lock order (DATABASE_SCHEMA §8): job_vacancy → applicant → application; take the vacancy lock first.
 */
export async function lockApplicant(client, applicantId) {
  await client.query("select 1 from public.applicant where applicant_id = $1 for update", [applicantId]);
}

export async function hasApplied(applicantId, vacancyId, db = pool) {
  const { rows } = await db.query(
    `select 1 from public.application where applicant_id = $1 and job_vacancy_id = $2`,
    [applicantId, vacancyId],
  );
  return rows.length > 0;
}

/** New application row. The history trigger logs it with the applicant as actor (vera.actor_id). */
export async function insertApplication(client, { applicantId, vacancyId, resumeId, applicantType, status, reason }) {
  const { rows } = await client.query(
    `insert into public.application (applicant_id, job_vacancy_id, resume_id, applicant_type, status, status_reason)
     values ($1, $2, $3, $4, $5, $6)
     returning application_id as "applicationId"`,
    [applicantId, vacancyId, resumeId, applicantType, status, reason],
  );
  return rows[0].applicationId;
}

/** svc /match result; matching_score is the value rounded once by storedMatchingScore (RANK-02). */
export async function insertMatchingResult(client, applicationId, { match, matchingScore, weights }) {
  await client.query(
    `insert into public.matching_result
       (application_id, matching_score, skills_score, experience_score, years_experience, matched_skills,
        missing_skills, skill_matches, experience_matches, warnings, weights, model_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      applicationId,
      matchingScore,
      match.scores?.skills ?? null,
      match.scores?.experience ?? null,
      match.yearsWorked ?? null,
      JSON.stringify(match.matchedSkills ?? []),
      JSON.stringify(match.missingSkills ?? []),
      JSON.stringify(match.skillMatches ?? []),
      JSON.stringify(match.experienceMatches ?? []),
      JSON.stringify(match.warnings ?? []),
      JSON.stringify(weights),
      match.modelName,
    ],
  );
}

/**
 * The applicant's applications for the status panel. Explicit columns: no company (CLAUDE.md rule 4),
 * no status_reason, and no matching numbers. nextDueAt = earliest pending document request (FR-DOC-03), the
 * deadline to confirm an interview (S13), or the deadline to confirm the endorsement (S15, action_due_at while
 * passed_awaiting_confirmation); least() ignores nulls. The status is a @vera/shared constant with an explicit cast.
 */
export async function listMyApplications(userId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.job_vacancy_id as "vacancyId", v.job_title as "jobTitle",
            a.applicant_type as "applicantType", a.status, a.applied_at as "appliedAt",
            a.status_changed_at as "statusChangedAt", a.action_due_at as "actionDueAt",
            least(
              (select min(q.due_at) from public.document_request q
                where q.application_id = a.application_id and q.status = $2),
              (select min(s.confirm_due_at) from public.interview_schedule s
                where s.application_id = a.application_id and s.status = $3),
              case when a.status = '${APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION}'::public.application_status
                   then a.action_due_at end
            ) as "nextDueAt"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where p.user_account_id = $1
      order by a.applied_at desc`,
    [userId, REQUEST_STATUS.PENDING, INTERVIEW_STATUS.PENDING_CONFIRMATION],
  );
  return rows;
}
