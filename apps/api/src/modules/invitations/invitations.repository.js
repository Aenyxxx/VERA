// SQL for pool matching on publish and job invitations (Phase 3, decision 17). A job invitation is a pool_invitation
// row with kind = 'job_invitation' (20261020010000); the rematch offers (S17) share the table and its one-pending index.
// HR queries may show names and scores; nothing here is returned to the applicant. Functions that write take the
// transaction client first. Any $n used twice in one statement carries the same explicit cast.
import { ACCOUNT_STATUS, BLOCKS_APPLYING_STATUSES, INVITATION_KIND, INVITATION_STATUS as IS, POOL_AVAILABILITY } from "@vera/shared";

import { pool } from "../../db/pool.js";
import { atFailedCompany, FAILED_STATUSES } from "../../domain/eligibility.js";
import { freePoolEntry } from "../../domain/pool.js";

const num = (value) => (value == null ? null : Number(value));

/**
 * Pool applicants this vacancy may invite (before prescreen and matching): free pool entries (S17 pool view), no
 * pending offer or invitation on the entry (one-pending index), never invited or offered this vacancy from the entry,
 * never applied to it, not at a company where they failed within 1 year (decision 5), with a confirmed profile and a
 * current resume extraction. The source application's type is carried over (answer 7).
 * Decision 37D: an applicant whose account HR deactivated from the Applicant Pool is never invited (account inactive,
 * entry availability 'unavailable'); both are checked so a run that started before the deactivation still skips them.
 */
export async function listPoolCandidates(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select tp.talent_pool_id as "talentPoolId", tp.applicant_id as "applicantId", p.user_account_id as "userId",
            sa.applicant_type as "applicantType", p.age, p.gender, p.education_level as "educationLevel",
            p.height_cm::float as "heightCm", r.resume_id as "resumeId", x.sections
       from public.talent_pool tp
       join public.application sa on sa.application_id = tp.source_application_id
       join public.v_applicant_profile p on p.applicant_id = tp.applicant_id
       join public.user_account ua on ua.user_account_id = p.user_account_id
       join public.resume r on r.applicant_id = tp.applicant_id and r.is_current
       join public.resume_extraction x on x.resume_id = r.resume_id
       join public.job_vacancy v on v.job_vacancy_id = $1::uuid
      where ${freePoolEntry("tp", "$2")}
        and ua.account_status = $5::public.account_status
        and tp.availability <> $6::public.pool_availability
        and not exists (select 1 from public.pool_invitation q
                         where q.talent_pool_id = tp.talent_pool_id and q.status = $3::public.invitation_status)
        and not exists (select 1 from public.pool_invitation q
                         where q.talent_pool_id = tp.talent_pool_id and q.job_vacancy_id = v.job_vacancy_id)
        and not exists (select 1 from public.application o
                         where o.applicant_id = tp.applicant_id and o.job_vacancy_id = v.job_vacancy_id)
        and not ${atFailedCompany("p.user_account_id", "$4")}
      order by tp.added_at, tp.talent_pool_id`,
    [vacancyId, BLOCKS_APPLYING_STATUSES, IS.PENDING, FAILED_STATUSES, ACCOUNT_STATUS.ACTIVE, POOL_AVAILABILITY.UNAVAILABLE],
  );
  return rows;
}

/**
 * True while the pool entry is still the applicant's active one and not deactivated (decision 37D: availability
 * 'unavailable' while the account is inactive). Re-read under the applicant lock, which the deactivation also takes.
 */
export async function isPoolEntryActive(client, talentPoolId) {
  const { rows } = await client.query(
    `select 1 from public.talent_pool
      where talent_pool_id = $1::uuid and removed_at is null and availability <> $2::public.pool_availability`,
    [talentPoolId, POOL_AVAILABILITY.UNAVAILABLE],
  );
  return rows.length > 0;
}

/** The job invitation (pending). The stored matching lets the accept create the application without svc. */
export async function insertInvitation(client, i) {
  const { rows } = await client.query(
    `insert into public.pool_invitation
       (talent_pool_id, job_vacancy_id, status, kind, invited_by, due_at, applicant_type, matching, matching_score)
     values ($1::uuid, $2::uuid, $3::public.invitation_status, $4::public.invitation_kind, $5::uuid, $6::timestamptz,
             $7::public.applicant_type, $8::jsonb, $9::numeric)
     returning pool_invitation_id as "invitationId", due_at as "dueAt"`,
    [
      i.talentPoolId, i.vacancyId, IS.PENDING, INVITATION_KIND.JOB_INVITATION, i.invitedBy, i.dueAt, i.applicantType,
      JSON.stringify(i.matching), i.matchingScore,
    ],
  );
  return rows[0];
}

/** The result of a pool-matching run (shown on the vacancy's Pool invitations tab). */
export async function setPoolMatchSummary(client, vacancyId, summary) {
  await client.query(
    `update public.job_vacancy set pool_matched_at = now(), pool_match_summary = $2::jsonb where job_vacancy_id = $1::uuid`,
    [vacancyId, JSON.stringify(summary)],
  );
}

/** HR: the vacancy's last run and its job invitations, newest first. */
export async function findVacancyInvitations(vacancyId, db = pool) {
  const [{ rows: vacancy }, { rows }] = await Promise.all([
    db.query(
      `select job_title as "jobTitle", status, pool_matched_at as "poolMatchedAt", pool_match_summary as "summary"
         from public.job_vacancy where job_vacancy_id = $1::uuid`,
      [vacancyId],
    ),
    db.query(
      `select pi.pool_invitation_id as "invitationId", trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
              pi.status, pi.matching_score as "matchingScore", pi.invited_at as "invitedAt", pi.due_at as "dueAt",
              pi.responded_at as "respondedAt", pi.application_id as "applicationId"
         from public.pool_invitation pi
         join public.talent_pool tp on tp.talent_pool_id = pi.talent_pool_id
         join public.applicant p on p.applicant_id = tp.applicant_id
        where pi.job_vacancy_id = $1::uuid and pi.kind = $2::public.invitation_kind
        order by pi.invited_at desc, pi.pool_invitation_id`,
      [vacancyId, INVITATION_KIND.JOB_INVITATION],
    ),
  ]);
  if (!vacancy[0]) return null;
  return { ...vacancy[0], invitations: rows.map((r) => ({ ...r, matchingScore: num(r.matchingScore) })) };
}
