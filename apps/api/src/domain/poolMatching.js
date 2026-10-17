// Pool matching on publish (Phase 3, decision 17; PRD FR-VAC-02, FR-POOL-02). The background run
// (modules/invitations/invitations.service.js → runPoolMatching) prescreens every free pool applicant against the newly
// published vacancy (RANK-01), matches the stored resume with svc /match using the pool entry's SOURCE applicant type
// (MAT-04, answer 7), rounds the score (RANK-02), and asks this rule whether to invite. Everyone who qualifies is
// invited: there is no ranking and no limit.
import { meetsThreshold } from "./shortlist.js";

// VERA-ALGO[RANK-05] BEGIN Pool matching on publish (decision 17)
// Rule: invite a free pool applicant iff prescreen passes (RANK-01) and M ≥ threshold (RANK-02), M = round₂(/match) with MAT-04 weights of the pool entry's SOURCE applicant type; no ranking, everyone who qualifies is invited   Ref: docs/ALGORITHM.md §4 RANK-05
/**
 * Why a pool applicant is not invited, or null when they are.
 * @param {{ prescreenPassed: boolean, matchingScore?: number, matchingThreshold?: number }} c
 * @returns {"prescreen"|"below_threshold"|null}
 */
export function invitationExclusion({ prescreenPassed, matchingScore, matchingThreshold }) {
  if (!prescreenPassed) return "prescreen"; // checked first: svc is never called for a prescreen failure
  if (!meetsThreshold(matchingScore, matchingThreshold)) return "below_threshold";
  return null;
}
// VERA-ALGO[RANK-05] END
