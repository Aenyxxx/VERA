// SQL for the final ranking and Notify (S15; PRD FR-END-01, FR-END-03; decision 37B: no applicant answer).
// HR queries may show the company and scores; the applicant query never does. pg returns numeric as strings, so
// every score is converted with Number(). Functions that write take the transaction client first. Any $n used
// twice in one statement carries the same explicit cast.
import { APPLICATION_STATUS as A, WITH_CLIENT_STATUSES } from "@vera/shared";

import { pool } from "../../db/pool.js";

const num = (value) => (value == null ? null : Number(value));

/**
 * Places already taken in the endorsement (BR-23 "endorsement full"): notified (decision 37B: for_endorsement; old
 * passed_awaiting_confirmation rows still count), or with the client (WITH_CLIENT_STATUSES, Phase 2).
 */
export const ENDORSEMENT_COMMITTED = Object.freeze([A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT, ...WITH_CLIENT_STATUSES]);

/** The vacancy with its endorsement count and the places already committed. */
export async function findRankingVacancy(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName",
            v.status, v.slots_needed as "slotsNeeded", v.endorsement_count as "endorsementCount",
            (select count(*)::int from public.application a
              where a.job_vacancy_id = v.job_vacancy_id
                and a.status = any($2::public.application_status[])) as "committed"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
      where v.job_vacancy_id = $1::uuid`,
    [vacancyId, ENDORSEMENT_COMMITTED],
  );
  return rows[0] ?? null;
}

/** Every evaluated application of the vacancy, any status (the ranking is a record; RANK-03 sorts it). */
export async function listEvaluatedApplications(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.applicant_type as "applicantType", a.status,
            a.applied_at as "appliedAt", a.action_due_at as "actionDueAt",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            fe.matching_score as "matchingScore", fe.interview_score as "interviewScore",
            fe.final_score as "finalScore", fe.passing_score as "passingScore", fe.passed,
            fe.overall_rating as "overallRating",
            (fe.ratings_source_application_id <> fe.application_id) as "reused"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.final_evaluation fe on fe.application_id = a.application_id
      where a.job_vacancy_id = $1::uuid`,
    [vacancyId],
  );
  return rows.map((r) => ({
    ...r,
    matchingScore: num(r.matchingScore),
    interviewScore: num(r.interviewScore),
    finalScore: num(r.finalScore),
    passingScore: num(r.passingScore),
    overallRating: num(r.overallRating),
  }));
}

/**
 * Row locks on the selected applications, ascending id (DATABASE_SCHEMA §8: after the job_vacancy lock). The rows
 * returned here are the ones that count.
 */
export async function lockApplicationsForNotify(client, applicationIds) {
  const { rows } = await client.query(
    `select a.application_id as "applicationId", a.job_vacancy_id as "vacancyId", a.status,
            p.user_account_id as "userId"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
      where a.application_id = any($1::uuid[])
      order by a.application_id
      for update of a`,
    [applicationIds],
  );
  return rows;
}
