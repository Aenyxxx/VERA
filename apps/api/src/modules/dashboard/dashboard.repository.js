// SQL for the HR dashboard (S18, PRD FR-ADM-01). Read-only. Every set comes from @vera/shared DASHBOARD_TILES; the
// applicant pool tile reuses the S17 pool-view condition (domain/pool.js → freePoolEntry). HR only: may show the company.
import { APPLICATION_STATUS as A, DASHBOARD_TILES as T, UPCOMING_INTERVIEWS_LIMIT } from "@vera/shared";

import { pool } from "../../db/pool.js";
import { LIVE_INTERVIEW_STATUSES } from "../../domain/interview.js";
import { freePoolEntry } from "../../domain/pool.js";

/** All tile counts in ONE statement, so they come from one snapshot. */
export async function countTiles(db = pool) {
  const { rows } = await db.query(
    `select
       (select count(*)::int from public.applicant) as "applicants",
       (select count(distinct a.applicant_id)::int from public.application a
         where a.status = any($1::public.application_status[])) as "waitingPool",
       (select count(distinct a.applicant_id)::int from public.application a
         where a.status = any($2::public.application_status[])) as "forScreening",
       (select count(distinct a.applicant_id)::int from public.application a
         where a.status = any($3::public.application_status[])) as "forInterview",
       (select count(distinct a.applicant_id)::int from public.application a
         where a.status = any($4::public.application_status[])) as "forEndorsement",
       (select count(distinct a.applicant_id)::int from public.application a
         where a.status = any($5::public.application_status[])) as "hired",
       (select count(*)::int from public.talent_pool tp
         where ${freePoolEntry("tp", "$6")}) as "applicantPool",
       (select count(*)::int from public.job_vacancy v
         where v.status = any($7::public.vacancy_status[])) as "activeVacancies"`,
    [
      T.waitingPool.statuses,
      T.forScreening.statuses,
      T.forInterview.statuses,
      T.forEndorsement.statuses,
      T.hired.statuses,
      T.applicantPool.blockingStatuses,
      T.activeVacancies.vacancyStatuses,
    ],
  );
  return rows[0];
}

/** Open interview attempts from now on (database clock), earliest first, at most UPCOMING_INTERVIEWS_LIMIT. */
export async function listUpcomingInterviews(db = pool) {
  const { rows } = await db.query(
    `select s.interview_schedule_id as "interviewId", s.application_id as "applicationId", s.status,
            s.scheduled_at as "scheduledAt", s.duration_minutes as "durationMinutes",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName",
            coalesce(u.full_name, u.email) as "interviewerName"
       from public.interview_schedule s
       join public.application a on a.application_id = s.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       join public.company c on c.company_id = v.company_id
       left join public.user_account u on u.user_account_id = s.interviewer_id
      where s.status = any($1::public.interview_status[])
        and a.status = any($2::public.application_status[])
        and s.scheduled_at >= now()
      order by s.scheduled_at, s.interview_schedule_id
      limit $3`,
    [LIVE_INTERVIEW_STATUSES, [A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED], UPCOMING_INTERVIEWS_LIMIT],
  );
  return rows;
}
