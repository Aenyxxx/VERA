// SQL for evaluations (S14; PRD FR-INT-06, FR-INT-08). HR only: may show the company and scores.
// Functions that write take the transaction client first. pg returns numeric as strings, so every score is
// converted with Number() here. Any $n used twice in one statement carries the same explicit cast.
import { pool } from "../../db/pool.js";

const num = (value) => (value == null ? null : Number(value));

/** What the evaluation needs about one application (read before the transaction to know which rows to lock). */
export async function findApplicationForEvaluation(applicationId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.applicant_id as "applicantId", a.job_vacancy_id as "vacancyId",
            a.applicant_type as "applicantType", a.status,
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName", p.user_account_id as "userId",
            v.job_title as "jobTitle", c.company_name as "companyName", v.passing_score as "passingScore",
            m.matching_score as "matchingScore"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       join public.company c on c.company_id = v.company_id
       left join public.matching_result m on m.application_id = a.application_id
      where a.application_id = $1::uuid`,
    [applicationId],
  );
  const row = rows[0];
  return row ? { ...row, passingScore: num(row.passingScore), matchingScore: num(row.matchingScore) } : null;
}

/**
 * The application's latest interview attempt. `started` = scheduled_at <= now(), decided by the database clock
 * (the same clock as the no-show rule's deadlines).
 */
export async function findLatestAttempt(applicationId, db = pool) {
  const { rows } = await db.query(
    `select interview_schedule_id as "interviewId", status, scheduled_at as "scheduledAt",
            (scheduled_at <= now()) as "started"
       from public.interview_schedule
      where application_id = $1::uuid
      order by attempt_number desc, created_at desc
      limit 1`,
    [applicationId],
  );
  return rows[0] ?? null;
}

/** The 15 stored ratings of one application (the interviewed one: a reused evaluation has none of its own). */
export async function listRatings(applicationId, db = pool) {
  const { rows } = await db.query(
    `select competency_id as "competencyId", rating
       from public.competency_rating
      where application_id = $1::uuid`,
    [applicationId],
  );
  return rows.map((r) => ({ competencyId: r.competencyId, rating: Number(r.rating) }));
}

/** The stored evaluation with the job it took its ratings from (itself, or the original interview for a reuse). */
export async function findEvaluation(applicationId, db = pool) {
  const { rows } = await db.query(
    `select fe.matching_score as "matchingScore", fe.interview_score as "interviewScore",
            fe.final_score as "finalScore", fe.passing_score as "passingScore", fe.passed,
            fe.overall_rating as "overallRating", fe.section_scores as "sectionScores",
            fe.ratings_source_application_id as "sourceApplicationId", fe.computed_at as "computedAt",
            sv.job_title as "sourceJobTitle", sc.company_name as "sourceCompanyName",
            sfe.computed_at as "sourceRatedAt"
       from public.final_evaluation fe
       join public.application src on src.application_id = fe.ratings_source_application_id
       join public.job_vacancy sv on sv.job_vacancy_id = src.job_vacancy_id
       join public.company sc on sc.company_id = sv.company_id
       left join public.final_evaluation sfe on sfe.application_id = src.application_id
      where fe.application_id = $1::uuid`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    matchingScore: num(row.matchingScore),
    interviewScore: num(row.interviewScore),
    finalScore: num(row.finalScore),
    passingScore: num(row.passingScore),
    overallRating: num(row.overallRating),
    sectionScores: Object.fromEntries(Object.entries(row.sectionScores ?? {}).map(([k, v]) => [k, Number(v)])),
  };
}

/** One statement for all 15 rows; the two arrays are typed so Postgres never has to guess. */
export async function insertRatings(client, { applicationId, applicantId, interviewId, hrId, ratings }) {
  await client.query(
    `insert into public.competency_rating
       (application_id, applicant_id, competency_id, interview_schedule_id, rating, rated_by)
     select $1::uuid, $2::uuid, r.competency_id, $3::uuid, r.rating, $4::uuid
       from unnest($5::uuid[], $6::smallint[]) as r (competency_id, rating)`,
    [applicationId, applicantId, interviewId, hrId, ratings.map((r) => r.competencyId), ratings.map((r) => r.rating)],
  );
}

/**
 * Stores the evaluation; final_score, passed, and overall_rating are generated columns (FIN-01, WSM-02 in SQL),
 * returned so the caller decides passed / did_not_pass from the stored values.
 */
export async function insertFinalEvaluation(
  client,
  { applicationId, matchingScore, interviewScore, passingScore, sectionScores, sourceApplicationId, hrId },
) {
  const { rows } = await client.query(
    `insert into public.final_evaluation
       (application_id, matching_score, interview_score, passing_score, section_scores,
        ratings_source_application_id, computed_by)
     values ($1::uuid, $2::numeric, $3::numeric, $4::numeric, $5::jsonb, $6::uuid, $7::uuid)
     returning matching_score as "matchingScore", interview_score as "interviewScore",
               final_score as "finalScore", passing_score as "passingScore", passed,
               overall_rating as "overallRating", section_scores as "sectionScores",
               ratings_source_application_id as "sourceApplicationId", computed_at as "computedAt"`,
    [applicationId, matchingScore, interviewScore, passingScore, JSON.stringify(sectionScores), sourceApplicationId, hrId],
  );
  const row = rows[0];
  return {
    ...row,
    matchingScore: num(row.matchingScore),
    interviewScore: num(row.interviewScore),
    finalScore: num(row.finalScore),
    passingScore: num(row.passingScore),
    overallRating: num(row.overallRating),
    sectionScores: Object.fromEntries(Object.entries(row.sectionScores ?? {}).map(([k, v]) => [k, Number(v)])),
  };
}

/** Short summary for the review sheet (S12 detail): null until an evaluation exists. */
export async function findEvaluationSummary(applicationId, db = pool) {
  const { rows } = await db.query(
    `select interview_score as "interviewScore", final_score as "finalScore", passed,
            overall_rating as "overallRating", (ratings_source_application_id <> application_id) as "reused"
       from public.final_evaluation
      where application_id = $1::uuid`,
    [applicationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    interviewScore: num(row.interviewScore),
    finalScore: num(row.finalScore),
    passed: row.passed,
    overallRating: num(row.overallRating),
    reused: row.reused,
  };
}
