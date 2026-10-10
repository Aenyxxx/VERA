// Automatic rematch after a client rejection (PRD BR-23, FR-END-10; ROADMAP S17, decided Oct 10, 2026).
// The scan (modules/rematch/rematch.service.js) prescreens every eligible open vacancy (RANK-01), matches the stored
// resume with svc /match using the carried-over applicant type (MAT-04), rounds and checks the threshold (RANK-02),
// and scores the ORIGINAL interview ratings with that vacancy's section weights (WSM-01/03, FIN-01). This block only
// decides which candidates stay and in which order; rank 1 is offered to the applicant automatically.
import { isPassed } from "@vera/shared";

import { meetsThreshold } from "./shortlist.js";

// VERA-ALGO[RANK-04] BEGIN Rematch ranking after a client rejection
// Rule: keep M ≥ threshold and F ≥ passing of THAT vacancy (M = stored matching, F = FIN-01 of M and the WSM-03 interview); order M DESC, then F DESC, then vacancy_id ASC; rank 1 is offered   Ref: docs/ALGORITHM.md §4 RANK-04
/**
 * Why a matched vacancy is left out, or null when it stays.
 * @param {{ matchingScore: number, finalScore: number, matchingThreshold: number, passingScore: number }} c
 * @returns {"below_threshold"|"below_passing"|null}
 */
export function excludedReason(c) {
  if (!meetsThreshold(c.matchingScore, c.matchingThreshold)) return "below_threshold";
  if (!isPassed(c.finalScore, c.passingScore)) return "below_passing";
  return null;
}

/** Higher matching first (the job that fits the resume best); then the higher final; then the vacancy id (always decides). */
export function compareRematch(a, b) {
  return b.matchingScore - a.matchingScore || b.finalScore - a.finalScore || a.vacancyId.localeCompare(b.vacancyId);
}

/**
 * @param {{ vacancyId: string, matchingScore: number, finalScore: number, matchingThreshold: number, passingScore: number }[]} candidates
 * @returns the kept candidates, best first, each with `rank` (1 = offered)
 */
export function rankRematch(candidates) {
  return candidates
    .filter((c) => excludedReason(c) === null)
    .sort(compareRematch)
    .map((c, index) => ({ rank: index + 1, ...c }));
}
// VERA-ALGO[RANK-04] END
