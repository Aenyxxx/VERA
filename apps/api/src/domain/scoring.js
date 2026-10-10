// Builds one evaluation from the 15 Competency Profile item ratings (PRD FR-INT-06, FR-INT-08, BR-06, BR-07).
// The formulas live in @vera/shared scoring.js (VERA-ALGO WSM-01, FIN-01) and competencies.js (WSM-02), so the
// evaluation page shows the same numbers live. The server always recomputes from the ratings here; a score sent
// by the browser is never used.
import { scoreEvaluation } from "@vera/shared";

import { businessRule } from "../lib/errors.js";

/**
 * Checks the ratings against the active rubric and scores them.
 * @param {{ rubric: { sectionCode: string, items: { competencyId: string }[] }[],
 *           ratings: { competencyId: string, rating: number }[],
 *           sectionWeights: { sectionCode: string, weight: number|null }[],
 *           matchingScore: number, passingScore: number, incompleteMessage?: string }} input
 *   rubric = listRubric() (active items by section); sectionWeights = the vacancy's weights in percent.
 * @returns {{ sectionScores: Record<string, number>, interviewScore: number, overallRating: number,
 *             finalScore: number, passed: boolean }}
 */
export function buildEvaluation({ rubric, ratings, sectionWeights, matchingScore, passingScore, incompleteMessage }) {
  if (matchingScore == null) throw businessRule("This application has no matching score.");
  const itemIds = rubric.flatMap((section) => section.items.map((item) => item.competencyId));
  const byItem = new Map(ratings.map((r) => [r.competencyId, Number(r.rating)]));

  // Every active item rated exactly once (TC-49), nothing else, each 1–5.
  const complete =
    byItem.size === ratings.length && ratings.length === itemIds.length && itemIds.every((id) => byItem.has(id));
  if (!complete) {
    throw businessRule(incompleteMessage ?? `Rate each of the ${itemIds.length} Competency Profile items once.`);
  }
  if ([...byItem.values()].some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw businessRule("Each rating must be a whole number from 1 to 5.");
  }

  const weights = Object.fromEntries(sectionWeights.map((w) => [w.sectionCode, Number(w.weight ?? 0)]));
  const sectionCodes = rubric.map((section) => section.sectionCode);
  // One weight per rubric section, nothing else (a stray code would add an unrated section to the sum).
  const sameSections =
    sectionWeights.length === sectionCodes.length && Object.keys(weights).every((code) => sectionCodes.includes(code));
  if (!sameSections) throw businessRule("This vacancy's section weights do not match the Competency Profile sections.");
  const weightTotal = Object.values(weights).reduce((sum, w) => sum + Math.round(w * 100), 0);
  if (weightTotal !== 10000) throw businessRule("This vacancy's section weights do not total 100%.");

  return scoreEvaluation({
    ratingsBySection: Object.fromEntries(
      rubric.map((section) => [section.sectionCode, section.items.map((item) => byItem.get(item.competencyId))]),
    ),
    sectionWeights: weights,
    matchingScore: Number(matchingScore),
    passingScore: Number(passingScore),
  });
}
