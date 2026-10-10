// Final ranking per vacancy (PRD FR-END-01, FR-VAC-06; DATABASE_SCHEMA §6.4; ROADMAP S15, decided Oct 10, 2026).
// Both applicant groups in one list. Every evaluated application of the vacancy is ranked, whatever its status now,
// so the ranking stays a record; only `passed` applications can be notified (modules/ranking).
// The scores are the stored ones (final_score is the FIN-01 generated column, matching_score is RANK-02's stored
// value), so no rounding happens here.

// VERA-ALGO[RANK-03] BEGIN Final ranking per vacancy (combined groups)
// Rule: order by final DESC, then matching DESC, then applied_at ASC, then application_id ASC; rank = position 1..n   Ref: docs/ALGORITHM.md §4 RANK-03
/** Higher final score first; a tie goes to the higher matching score, then the earlier application, then the id. */
export function compareRanking(a, b) {
  return (
    b.finalScore - a.finalScore ||
    b.matchingScore - a.matchingScore ||
    new Date(a.appliedAt) - new Date(b.appliedAt) ||
    a.applicationId.localeCompare(b.applicationId)
  );
}

/**
 * @param {{ applicationId: string, finalScore: number, matchingScore: number, appliedAt: string|Date }[]} rows
 * @returns the same rows sorted, each with `rank` (1 = best); the id tie-break makes every rank unique
 */
export function rankApplications(rows) {
  return [...rows].sort(compareRanking).map((row, index) => ({ rank: index + 1, ...row }));
}
// VERA-ALGO[RANK-03] END
