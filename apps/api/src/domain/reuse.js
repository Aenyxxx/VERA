// Rating reuse (PRD BR-21): where an applicant's earlier competency ratings come from.
// S12 only looks the source up (Resume Screening shows "Ratings on file"); the score itself is computed in S14.

// VERA-ALGO[WSM-03] BEGIN Rating reuse: find the original interview whose 15 ratings are reused
// Rule: source = ratings_source_application_id of the applicant's most recent completed final_evaluation (any other application); a reused evaluation already points at the original interview, so a chain of reuses resolves in one step   Ref: docs/ALGORITHM.md §4 WSM-03
/**
 * @param {import("pg").Pool | import("pg").PoolClient} db
 * @param {string} applicantId
 * @param {string} excludeApplicationId the application being screened (its own evaluation never counts)
 * @returns {Promise<{ sourceApplicationId: string, jobTitle: string, companyName: string, ratedAt: string } | null>}
 */
export async function reusedRatingsSource(db, applicantId, excludeApplicationId) {
  const { rows } = await db.query(
    `with latest as (
       select fe.ratings_source_application_id as source_id
         from public.final_evaluation fe
         join public.application a on a.application_id = fe.application_id
        where a.applicant_id = $1 and a.application_id <> $2
        order by fe.computed_at desc
        limit 1
     )
     select src.application_id as "sourceApplicationId", v.job_title as "jobTitle",
            c.company_name as "companyName", sfe.computed_at as "ratedAt"
       from latest
       join public.application src on src.application_id = latest.source_id
       join public.job_vacancy v on v.job_vacancy_id = src.job_vacancy_id
       join public.company c on c.company_id = v.company_id
       left join public.final_evaluation sfe on sfe.application_id = src.application_id`,
    [applicantId, excludeApplicationId],
  );
  return rows[0] ?? null;
}
// VERA-ALGO[WSM-03] END
