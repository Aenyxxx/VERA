// SQL for the automatic rematch (S17, PRD BR-23). The offer is a pool_invitation row (migration 20261011000000).
// HR queries may show the company and scores; the applicant query never does. Functions that write take the
// transaction client first. Any $n used twice in one statement carries the same explicit cast.
import {
  APPLICATION_SOURCE,
  APPLICATION_STATUS as A,
  INVITATION_STATUS as IS,
  POOL_AVAILABILITY,
  VACANCY_STATUS as V,
} from "@vera/shared";

import { pool } from "../../db/pool.js";
import { atFailedCompany, BLOCKS_APPLYING_STATUSES, FAILED_STATUSES } from "../../domain/eligibility.js";
import { ENDORSEMENT_COMMITTED } from "../ranking/ranking.repository.js";

const num = (value) => (value == null ? null : Number(value));

/** The not_hired application the rematch starts from, its original interview, and the applicant's active pool entry. */
export async function findRematchSource(applicationId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.status, a.applicant_id as "applicantId",
            a.applicant_type as "applicantType", p.user_account_id as "userId",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            fe.ratings_source_application_id as "ratingsSourceApplicationId", a.job_vacancy_id as "vacancyId",
            tp.talent_pool_id as "talentPoolId", tp.source_application_id as "poolSourceApplicationId"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       left join public.final_evaluation fe on fe.application_id = a.application_id
       left join public.talent_pool tp on tp.applicant_id = a.applicant_id and tp.removed_at is null
      where a.application_id = $1::uuid`,
    [applicationId],
  );
  return rows[0] ?? null;
}

/** The applicant's ongoing or hired application (BR-17), or null. */
export async function findBlocking(applicantId, db = pool) {
  const { rows } = await db.query(
    `select application_id from public.application
      where applicant_id = $1::uuid and status = any($2::public.application_status[]) limit 1`,
    [applicantId, BLOCKS_APPLYING_STATUSES],
  );
  return rows[0] ?? null;
}

/** The pending offer of a pool entry, or null (read under the applicant lock in the offer transaction). */
export async function findPendingOffer(talentPoolId, db = pool) {
  const { rows } = await db.query(
    `select pool_invitation_id as "offerId" from public.pool_invitation
      where talent_pool_id = $1::uuid and status = $2::public.invitation_status`,
    [talentPoolId, IS.PENDING],
  );
  return rows[0] ?? null;
}

/**
 * Open vacancies the applicant may be rematched to (BR-23): open; not at a company where the applicant has a failed
 * application (covers the not_hired company, BR-19); endorsement not full (notified + confirmed + endorsed <
 * endorsement count); never applied there (BR-14); never offered from this pool entry (declined / expired skipped).
 * Prescreen and matching inputs included (internal only).
 */
export async function listRematchVacancies({ applicantId, userId, talentPoolId }, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName",
            v.required_skills as "requiredSkills", v.experience_requirement as "experienceRequirement",
            v.min_years_experience as "minYearsExperience", v.min_age as "minAge", v.max_age as "maxAge",
            v.gender_requirement as "genderRequirement", v.min_education_level as "minEducationLevel",
            v.min_height_cm::float as "minHeightCm", v.matching_threshold::float as "matchingThreshold",
            v.passing_score::float as "passingScore"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
      where v.status = $1::public.vacancy_status
        and not ${atFailedCompany("$2", "$3")}
        and (select count(*) from public.application e
              where e.job_vacancy_id = v.job_vacancy_id and e.status = any($4::public.application_status[])) < v.endorsement_count
        and not exists (select 1 from public.application o where o.job_vacancy_id = v.job_vacancy_id and o.applicant_id = $5::uuid)
        and not exists (select 1 from public.pool_invitation pi
                         where pi.job_vacancy_id = v.job_vacancy_id and pi.talent_pool_id = $6::uuid)
      order by v.job_vacancy_id`,
    [V.OPEN, userId, FAILED_STATUSES, ENDORSEMENT_COMMITTED, applicantId, talentPoolId],
  );
  return rows;
}

/** The offer row (pending). Numbers and the svc matching result are stored for the accept. */
export async function insertOffer(client, o) {
  const { rows } = await client.query(
    `insert into public.pool_invitation
       (talent_pool_id, job_vacancy_id, status, invited_by, due_at, applicant_type, matching, matching_score,
        section_scores, interview_score, final_score, ratings_source_application_id)
     values ($1::uuid, $2::uuid, $3::public.invitation_status, null, $4::timestamptz, $5::public.applicant_type,
             $6::jsonb, $7::numeric, $8::jsonb, $9::numeric, $10::numeric, $11::uuid)
     returning pool_invitation_id as "offerId", due_at as "dueAt"`,
    [
      o.talentPoolId, o.vacancyId, IS.PENDING, o.dueAt, o.applicantType, JSON.stringify(o.matching), o.matchingScore,
      JSON.stringify(o.sectionScores), o.interviewScore, o.finalScore, o.ratingsSourceApplicationId,
    ],
  );
  return rows[0];
}

export async function setPoolAvailability(client, talentPoolId, availability) {
  await client.query(
    `update public.talent_pool set availability = $2::public.pool_availability
      where talent_pool_id = $1::uuid and removed_at is null`,
    [talentPoolId, availability],
  );
}

/** One offer with everything the answer needs (read before the transaction, then again under the locks). */
export async function findOffer(offerId, db = pool) {
  const { rows } = await db.query(
    `select pi.pool_invitation_id as "offerId", pi.status, pi.talent_pool_id as "talentPoolId",
            pi.job_vacancy_id as "vacancyId", pi.due_at as "dueAt", pi.applicant_type as "applicantType",
            pi.matching, pi.matching_score as "matchingScore", pi.section_scores as "sectionScores",
            pi.interview_score as "interviewScore", pi.final_score as "finalScore",
            pi.ratings_source_application_id as "ratingsSourceApplicationId",
            tp.applicant_id as "applicantId", (tp.removed_at is null) as "poolActive", p.user_account_id as "userId",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            v.job_title as "jobTitle", c.company_name as "companyName", v.passing_score as "passingScore",
            v.endorsement_count as "endorsementCount"
       from public.pool_invitation pi
       join public.talent_pool tp on tp.talent_pool_id = pi.talent_pool_id
       join public.applicant p on p.applicant_id = tp.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = pi.job_vacancy_id
       join public.company c on c.company_id = v.company_id
      where pi.pool_invitation_id = $1::uuid`,
    [offerId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    matchingScore: num(row.matchingScore),
    interviewScore: num(row.interviewScore),
    finalScore: num(row.finalScore),
    passingScore: num(row.passingScore),
  };
}

/** Compare-and-set on the offer status (written only under the applicant lock). */
export async function setOfferStatus(client, offerId, from, to, applicationId = null) {
  const { rowCount } = await client.query(
    `update public.pool_invitation
        set status = $3::public.invitation_status, responded_at = now(),
            application_id = coalesce($4::uuid, application_id)
      where pool_invitation_id = $1::uuid and status = $2::public.invitation_status`,
    [offerId, from, to, applicationId],
  );
  return rowCount === 1;
}

/** Places already taken in the vacancy's endorsement (BR-23 "endorsement full"), re-read under the vacancy lock. */
export async function countCommitted(client, vacancyId) {
  const { rows } = await client.query(
    `select count(*)::int as "committed" from public.application
      where job_vacancy_id = $1::uuid and status = any($2::public.application_status[])`,
    [vacancyId, ENDORSEMENT_COMMITTED],
  );
  return rows[0].committed;
}

/** The accepted offer's application: source rematch, straight to for_endorsement (BR-23; assertInitial checks it). */
export async function insertRematchApplication(client, { applicantId, vacancyId, resumeId, applicantType }) {
  const { rows } = await client.query(
    `insert into public.application
       (applicant_id, job_vacancy_id, resume_id, applicant_type, status, status_reason, application_source)
     values ($1::uuid, $2::uuid, $3::uuid, $4::public.applicant_type, $5::public.application_status, $6::text,
             $7::public.application_source)
     returning application_id as "applicationId"`,
    [applicantId, vacancyId, resumeId, applicantType, A.FOR_ENDORSEMENT, "Accepted rematch offer", APPLICATION_SOURCE.REMATCH],
  );
  return rows[0].applicationId;
}

/** Accept closes the pool entry: the applicant is back in the process (BR-23). */
export async function closePoolEntry(client, talentPoolId) {
  await client.query(
    `update public.talent_pool set removed_at = now(), availability = $2::public.pool_availability
      where talent_pool_id = $1::uuid and removed_at is null`,
    [talentPoolId, POOL_AVAILABILITY.REAPPLIED],
  );
}

/** The applicant's pending offers (job title, location, type, deadline): never the company or a score. */
export async function listMyOffers(userId, db = pool) {
  const { rows } = await db.query(
    `select pi.pool_invitation_id as "offerId", v.job_title as "jobTitle", v.deployment_location as "deploymentLocation",
            v.employment_type as "employmentType", pi.due_at as "dueAt", pi.invited_at as "offeredAt"
       from public.pool_invitation pi
       join public.talent_pool tp on tp.talent_pool_id = pi.talent_pool_id
       join public.applicant p on p.applicant_id = tp.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = pi.job_vacancy_id
      where p.user_account_id = $1::uuid and pi.status = $2::public.invitation_status
      order by pi.invited_at desc`,
    [userId, IS.PENDING],
  );
  return rows;
}

/**
 * Applicant pool (FR-POOL-01): active entries of applicants with NO ongoing or hired application (an active entry
 * can stay behind when the applicant applied elsewhere, so removed_at alone is not enough), with the latest offer.
 */
export async function listPool(db = pool) {
  const { rows } = await db.query(
    `select tp.talent_pool_id as "talentPoolId", tp.pool_reason as "poolReason", tp.availability, tp.added_at as "addedAt",
            tp.source_application_id as "sourceApplicationId",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            sv.job_title as "sourceJobTitle", sc.company_name as "sourceCompanyName",
            lo.status as "offerStatus", lo.job_title as "offerJobTitle", lo.company_name as "offerCompanyName",
            lo.invited_at as "offeredAt"
       from public.talent_pool tp
       join public.applicant p on p.applicant_id = tp.applicant_id
       join public.application sa on sa.application_id = tp.source_application_id
       join public.job_vacancy sv on sv.job_vacancy_id = sa.job_vacancy_id
       join public.company sc on sc.company_id = sv.company_id
       left join lateral (
         select pi.status, ov.job_title, oc.company_name, pi.invited_at
           from public.pool_invitation pi
           join public.job_vacancy ov on ov.job_vacancy_id = pi.job_vacancy_id
           join public.company oc on oc.company_id = ov.company_id
          where pi.talent_pool_id = tp.talent_pool_id
          order by pi.invited_at desc
          limit 1
       ) lo on true
      where tp.removed_at is null
        and not exists (select 1 from public.application b
                         where b.applicant_id = tp.applicant_id and b.status = any($1::public.application_status[]))
      order by tp.added_at desc`,
    [BLOCKS_APPLYING_STATUSES],
  );
  return rows;
}
