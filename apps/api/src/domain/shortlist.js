// Matching threshold and automatic shortlist per vacancy and applicant type
// (PRD BR-01, BR-05, BR-11, BR-12; DATABASE_SCHEMA §6.2). Runs after every new application, drop, or termination.
import { APPLICATION_SOURCE, APPLICATION_STATUS as A, NOTIFICATION_TYPE as N } from "@vera/shared";

import { notify } from "./notify.js";
import { roundHundredths } from "./round.js";
import { transition } from "./statusMachine.js";

const SHORTLIST_REFRESH = "shortlist refresh";

// VERA-ALGO[RANK-02] BEGIN Matching threshold and shortlist ranking per applicant type
// Rule: below_threshold if round₂(matching) < threshold; shortlist = top (2 × slots − occupied) by matching DESC, applied_at ASC, application_id ASC; locked slots are never displaced   Ref: docs/ALGORITHM.md §4 RANK-02

/** The stored matching score: rounded once to hundredths, half-up (39.995 → 40.00). */
export function storedMatchingScore(matchScore) {
  return roundHundredths(matchScore);
}

/** BR-05: an application stays in the process only if its stored score reaches the vacancy's threshold. */
export function meetsThreshold(storedScore, threshold) {
  return storedScore >= threshold;
}

/** Ranking order: higher matching score first; earlier application wins a tie; then the id (always decides). */
export function compareCandidates(a, b) {
  return (
    b.matchingScore - a.matchingScore ||
    new Date(a.appliedAt) - new Date(b.appliedAt) ||
    a.applicationId.localeCompare(b.applicationId)
  );
}

/**
 * Pure shortlist choice for one group.
 * @param {{ quota: number, occupied: number,
 *           candidates: { applicationId: string, status: string, matchingScore: number, appliedAt: string|Date }[] }} input
 *   quota = shortlist_per_group (2 × slots); occupied = locked or past-screening applications of the group;
 *   candidates = waiting_pool + unlocked shortlisted applications of the group.
 * @returns {{ promote: object[], demote: object[] }} waiting_pool → shortlisted, and shortlisted → waiting_pool (displaced)
 */
export function selectShortlist({ quota, occupied, candidates }) {
  const openSlots = Math.max(quota - occupied, 0);
  const ranked = [...candidates].sort(compareCandidates);
  const top = ranked.slice(0, openSlots);
  const rest = ranked.slice(openSlots);
  return {
    promote: top.filter((c) => c.status === A.WAITING_POOL),
    demote: rest.filter((c) => c.status === A.SHORTLISTED),
  };
}

// Applications already past screening keep their slot (DATABASE_SCHEMA §6.2 step 2).
const PAST_SCREENING = [
  A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED, A.PASSED, A.DID_NOT_PASS, A.PASSED_AWAITING_CONFIRMATION,
  A.FOR_ENDORSEMENT, A.ENDORSED, A.STANDBY, A.HIRED, A.NOT_HIRED, A.TRAINING_FAILED, A.ARCHIVED,
];

/**
 * Refreshes one group's shortlist under the vacancy row lock (two requests can never shortlist at once).
 * Talent-pool applications are left out: they do not use shortlist slots (FR-POOL-04).
 * The moves are made by the system, not by whoever triggered the refresh: vera.actor_id is cleared for them,
 * so application_status_history records changed_by = null with reason "shortlist refresh".
 * @param {import("pg").PoolClient} client inside withTransaction
 * @returns {Promise<{ promoted: string[], demoted: string[] }>} application ids
 */
export async function refreshShortlist(client, vacancyId, applicantType) {
  const { rows: locked } = await client.query(
    `select shortlist_per_group as "quota", job_title as "jobTitle"
       from public.job_vacancy where job_vacancy_id = $1 for update`,
    [vacancyId],
  );
  const { quota, jobTitle } = locked[0];

  const { rows: counted } = await client.query(
    `select count(*)::int as "occupied"
       from public.application
      where job_vacancy_id = $1 and applicant_type = $2 and application_source = $3
        and ((status = $4 and verification_started_at is not null) or status = any($5::public.application_status[]))`,
    [vacancyId, applicantType, APPLICATION_SOURCE.DIRECT, A.SHORTLISTED, PAST_SCREENING],
  );

  const { rows: candidates } = await client.query(
    `select a.application_id as "applicationId", a.status, a.applied_at as "appliedAt",
            m.matching_score::float as "matchingScore", p.user_account_id as "userId"
       from public.application a
       join public.matching_result m on m.application_id = a.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
      where a.job_vacancy_id = $1 and a.applicant_type = $2 and a.application_source = $3
        and (a.status = $4 or (a.status = $5 and a.verification_started_at is null))`,
    [vacancyId, applicantType, APPLICATION_SOURCE.DIRECT, A.WAITING_POOL, A.SHORTLISTED],
  );

  const { promote, demote } = selectShortlist({ quota, occupied: counted[0].occupied, candidates });
  if (promote.length === 0 && demote.length === 0) return { promoted: [], demoted: [] };

  await asSystem(client, async () => {
    // Demote first so a promoted applicant never sees more shortlisted rows than the quota.
    for (const c of demote) {
      await transition(client, c, A.WAITING_POOL, SHORTLIST_REFRESH);
      await notify(client, { userId: c.userId, type: N.SHORTLIST_DISPLACED, applicationId: c.applicationId, vars: { jobTitle } });
    }
    for (const c of promote) {
      await transition(client, c, A.SHORTLISTED, SHORTLIST_REFRESH);
      await notify(client, { userId: c.userId, type: N.SHORTLISTED, applicationId: c.applicationId, vars: { jobTitle } });
    }
  });

  return { promoted: promote.map((c) => c.applicationId), demoted: demote.map((c) => c.applicationId) };
}
// VERA-ALGO[RANK-02] END

/**
 * Runs fn with vera.actor_id cleared (history changed_by = null = system), then restores the previous actor.
 * set_config(..., true) is transaction-local (= SET LOCAL), like withTransaction: it can never leak to the
 * next transaction on this pooled connection.
 */
async function asSystem(client, fn) {
  const { rows } = await client.query("select coalesce(current_setting('vera.actor_id', true), '') as actor");
  await client.query("select set_config('vera.actor_id', '', true)");
  try {
    return await fn();
  } finally {
    // Also after a JS error (e.g. a 409 from transition), which leaves the transaction usable. If a SQL error
    // aborted the transaction, this query fails too: ignore it so the original error surfaces (the rollback
    // discards the setting anyway).
    await client.query("select set_config('vera.actor_id', $1, true)", [rows[0].actor]).catch(() => {});
  }
}
