// HR dashboard tiles and the Applicant Management filters (PRD FR-ADM-01/02, ROADMAP S18, decided Oct 11, 2026).
// ONE definition per tile, used by the API (counts and list filters), the tests, the web page, and check-s18
// (which reads the sets back from GET /api/admin/dashboard). DATABASE_SCHEMA §6.5 shows the same SQL.
import { APPLICATION_STATUS as A, BLOCKS_APPLYING_STATUSES, VACANCY_STATUS as V, WITH_CLIENT_STATUSES } from "./statuses.js";

/**
 * - counts "profiles": every confirmed applicant profile (applicant rows), applied or not.
 * - counts "distinct applicants": applicants with an application in `statuses`. Every status used here is ongoing
 *   or hired, so the unique index application_one_ongoing_per_applicant allows one per applicant anyway.
 *   passed and passed_awaiting_confirmation are in no tile (§6.5), and neither is any final status.
 * - counts "free pool entries": active applicant-pool entries whose applicant has no application in
 *   `blockingStatuses` (the S17 pool view; API: domain/pool.js → freePoolEntry).
 * - counts "vacancies": vacancies in `vacancyStatuses`. closed (cap reached or HR pause) keeps its waiting pool
 *   (BR-22) and endorsing waits for client outcomes, so both are still active; draft, filled, archived are not.
 */
export const DASHBOARD_TILES = Object.freeze({
  applicants: Object.freeze({ label: "Total applicants", counts: "profiles" }),
  waitingPool: Object.freeze({ label: "Waiting pool", counts: "distinct applicants", statuses: Object.freeze([A.WAITING_POOL]) }),
  forScreening: Object.freeze({ label: "For screening", counts: "distinct applicants", statuses: Object.freeze([A.SHORTLISTED]) }),
  forInterview: Object.freeze({
    label: "For interview",
    counts: "distinct applicants",
    statuses: Object.freeze([A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED]),
  }),
  forEndorsement: Object.freeze({
    label: "For endorsement",
    counts: "distinct applicants",
    statuses: Object.freeze([A.FOR_ENDORSEMENT, ...WITH_CLIENT_STATUSES]), // + final interview, for hiring (Phase 2)
  }),
  hired: Object.freeze({ label: "Hired", counts: "distinct applicants", statuses: Object.freeze([A.HIRED]) }),
  applicantPool: Object.freeze({ label: "Applicant pool", counts: "free pool entries", blockingStatuses: BLOCKS_APPLYING_STATUSES }),
  activeVacancies: Object.freeze({
    label: "Active vacancies",
    counts: "vacancies",
    vacancyStatuses: Object.freeze([V.OPEN, V.CLOSED, V.ENDORSING]),
  }),
});

/** Display order of the tiles. */
export const DASHBOARD_TILE_ORDER = Object.freeze([
  "applicants",
  "waitingPool",
  "forScreening",
  "forInterview",
  "forEndorsement",
  "hired",
  "applicantPool",
  "activeVacancies",
]);

/** Applicant Management status filter: the tile keys that select applicants (same sets as the tiles). */
export const APPLICANT_FILTERS = Object.freeze(["waitingPool", "forScreening", "forInterview", "forEndorsement", "hired", "applicantPool"]);

export const UPCOMING_INTERVIEWS_LIMIT = 10;
export const APPLICANT_PAGE_MAX = 50;
