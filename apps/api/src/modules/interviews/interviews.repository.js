// SQL for interview scheduling (S13). HR queries may show the company and scores; the applicant query never does.
// Functions that write take the transaction client first. interview_schedule rows are only written while their
// application row is locked (DATABASE_SCHEMA §8), so they need no lock of their own.
import { ACCOUNT_STATUS, APPLICATION_STATUS as A, INTERVIEW_STATUS as I, STAFF_ROLES } from "@vera/shared";

import { OPEN_INTERVIEW_STATUSES } from "../../domain/interview.js";
import { pool } from "../../db/pool.js";

const OPEN = OPEN_INTERVIEW_STATUSES.map((s) => `'${s}'`).join(", ");
const IN_INTERVIEW = `'${A.INTERVIEW_SCHEDULED}', '${A.INTERVIEW_CONFIRMED}'`;

/** Active HR and admin accounts for the interviewer select. */
export async function listInterviewers(db = pool) {
  const { rows } = await db.query(
    `select user_account_id as "userId", coalesce(full_name, email) as "fullName", role
       from public.user_account
      where role = any($1::public.user_role[]) and account_status = $2
      order by coalesce(full_name, email)`,
    [STAFF_ROLES, ACCOUNT_STATUS.ACTIVE],
  );
  return rows;
}

export async function isActiveInterviewer(interviewerId, db = pool) {
  const { rows } = await db.query(
    `select 1 from public.user_account
      where user_account_id = $1 and role = any($2::public.user_role[]) and account_status = $3`,
    [interviewerId, STAFF_ROLES, ACCOUNT_STATUS.ACTIVE],
  );
  return rows.length === 1;
}

/** Open interview attempts for HR (combined list, both groups; FR-INT-01). */
export async function listInterviewsForHr({ vacancyId }, db = pool) {
  const { rows } = await db.query(
    `select s.interview_schedule_id as "interviewId", s.application_id as "applicationId",
            s.status, s.attempt_number as "attemptNumber", s.scheduled_at as "scheduledAt",
            s.duration_minutes as "durationMinutes", s.meeting_link as "meetingLink",
            s.confirm_due_at as "confirmDueAt", s.confirmed_at as "confirmedAt",
            s.interviewer_id as "interviewerId", coalesce(u.full_name, u.email) as "interviewerName",
            a.status as "applicationStatus", a.applicant_type as "applicantType",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            m.matching_score::float as "matchingScore",
            v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName"
       from public.interview_schedule s
       join public.application a on a.application_id = s.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       join public.company c on c.company_id = v.company_id
       left join public.matching_result m on m.application_id = a.application_id
       left join public.user_account u on u.user_account_id = s.interviewer_id
      where s.status in (${OPEN}) and a.status in (${IN_INTERVIEW})
        and ($1::uuid is null or a.job_vacancy_id = $1::uuid)
      order by s.scheduled_at, a.application_id`,
    [vacancyId ?? null],
  );
  return rows;
}

/**
 * The applicant's open interviews. Explicit columns: job title only, never the company, scores, or status_reason
 * (CLAUDE.md rule 4). The meeting link is shown once the applicant confirmed (APP_FLOW §3.3).
 */
export async function listMyInterviews(userId, db = pool) {
  const { rows } = await db.query(
    `select s.interview_schedule_id as "interviewId", s.application_id as "applicationId",
            v.job_title as "jobTitle", s.status, s.scheduled_at as "scheduledAt",
            s.duration_minutes as "durationMinutes", s.confirm_due_at as "confirmDueAt",
            s.confirmed_at as "confirmedAt", u.full_name as "interviewerName",
            case when s.status = '${I.CONFIRMED}' then s.meeting_link end as "meetingLink"
       from public.interview_schedule s
       join public.application a on a.application_id = s.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       left join public.user_account u on u.user_account_id = s.interviewer_id
      where p.user_account_id = $1 and s.status in (${OPEN}) and a.status in (${IN_INTERVIEW})
      order by s.scheduled_at`,
    [userId],
  );
  return rows;
}

/**
 * One attempt with what the services need to lock and notify. Read before the transaction to find the rows to
 * lock, then read again with the transaction client after the application lock (the values that count).
 */
export async function findInterview(interviewId, db = pool) {
  const { rows } = await db.query(
    `select s.interview_schedule_id as "interviewId", s.application_id as "applicationId", s.status,
            s.scheduled_at as "scheduledAt", s.confirm_due_at as "confirmDueAt",
            a.job_vacancy_id as "vacancyId", a.applicant_id as "applicantId",
            p.user_account_id as "userId", trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            v.job_title as "jobTitle"
       from public.interview_schedule s
       join public.application a on a.application_id = s.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where s.interview_schedule_id = $1`,
    [interviewId],
  );
  return rows[0] ?? null;
}

export async function insertInterview(
  client,
  { applicationId, interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt, hrId },
) {
  const { rows } = await client.query(
    `insert into public.interview_schedule
       (application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, confirm_due_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning interview_schedule_id as "interviewId", status, attempt_number as "attemptNumber",
               scheduled_at as "scheduledAt", confirm_due_at as "confirmDueAt"`,
    [applicationId, interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt, hrId],
  );
  return rows[0];
}

/** HR edits the open attempt in place (attempt_number unchanged). confirmDueAt null keeps the current deadline. */
export async function updateInterview(client, interviewId, { interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt }) {
  const { rows } = await client.query(
    `update public.interview_schedule
        set interviewer_id = $2, scheduled_at = $3, duration_minutes = $4, meeting_link = $5,
            confirm_due_at = coalesce($6, confirm_due_at), updated_at = now()
      where interview_schedule_id = $1 and status in (${OPEN})
      returning interview_schedule_id as "interviewId", status, scheduled_at as "scheduledAt",
                confirm_due_at as "confirmDueAt"`,
    [interviewId, interviewerId, scheduledAt, durationMinutes, meetingLink, confirmDueAt],
  );
  return rows[0] ?? null;
}

/**
 * Moves an attempt from `from` to `to` (stale-read safe like statusMachine.transition).
 * $3 appears twice, so every status parameter is cast explicitly: Postgres must deduce ONE type per parameter
 * ("inconsistent types deduced for parameter $3" otherwise).
 */
export async function setInterviewStatus(client, interviewId, from, to) {
  const { rowCount } = await client.query(
    `update public.interview_schedule
        set status = $3::public.interview_status, updated_at = now(),
            confirmed_at = case when $3::public.interview_status = '${I.CONFIRMED}' then now() else confirmed_at end
      where interview_schedule_id = $1 and status = $2::public.interview_status`,
    [interviewId, from, to],
  );
  return rowCount === 1;
}
