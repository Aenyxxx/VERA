// Who may apply where (PRD BR-17..BR-19, decided Oct 7, 2026).
// - One ongoing application at a time; hired blocks applying until training_failed (BR-17).
// - A failed application (did_not_pass, not_hired, training_failed, dropped) blocks every vacancy of that
//   company for the applicant for 1 year from the failed outcome (BR-19; decision 5, Oct 13, 2026). The outcome
//   date is application.status_changed_at: failed statuses are final (no move out of them in statusMachine.js), so
//   it is when the application failed. Neutral finals (prescreen_failed, below_threshold,
//   not_selected, standby, archived, terminated) never block. Applicants are never told which company or why:
//   blocked vacancies are hidden from the job list and answer 404 like a closed job (CLAUDE.md rule 4).
import { APPLICATION_OUTCOME, BLOCKS_APPLYING_STATUSES } from "@vera/shared";

export const FAILED_STATUSES = APPLICATION_OUTCOME.FAILED;
export { BLOCKS_APPLYING_STATUSES };

/** Fixed company-block period (decision 5). A code constant, not a setting: it is not a response deadline (rule 10). */
export const COMPANY_BLOCK_YEARS = 1;

/**
 * SQL condition: the vacancy aliased `v` is at a company where this user has a failed application from the last
 * COMPANY_BLOCK_YEARS. ONE rule for apply, the job list and detail, the rematch scan, and the rematch accept.
 * Only job_vacancy.company_id is compared; no company table, no company columns.
 * @param {string} userParam placeholder holding the user_account_id, e.g. "$5"
 * @param {string} failedParam placeholder holding FAILED_STATUSES, e.g. "$6"
 */
export function atFailedCompany(userParam, failedParam) {
  return `exists (
      select 1
        from public.application fa
        join public.applicant fp on fp.applicant_id = fa.applicant_id
        join public.job_vacancy fv on fv.job_vacancy_id = fa.job_vacancy_id
       where fp.user_account_id = ${userParam}
         and fv.company_id = v.company_id
         and fa.status = any(${failedParam}::public.application_status[])
         and fa.status_changed_at > now() - make_interval(years => ${COMPANY_BLOCK_YEARS}))`;
}

/** The opposite of atFailedCompany: used to leave blocked vacancies out of the applicant job list and detail. */
export function notAtFailedCompany(userParam, failedParam) {
  return `not ${atFailedCompany(userParam, failedParam)}`;
}
