// Interview score, overall rating, and final score (docs/ALGORITHM.md §4 WSM-01, WSM-02, FIN-01; PRD BR-06, BR-07).
// Shared by the API (which stores the numbers) and the evaluation page (which shows the same numbers live).
// The API always recomputes from the 15 item ratings; a score sent by the browser is never stored.
//
// Every step works in whole hundredths (integers), so JS, SQL, and the UI agree to the last digit:
// a 2-decimal score s is the integer round(s × 100) (79.31 → 7931), and a result h is shown as h / 100.
// Math.round on a non-negative value rounds half up, the same as Postgres round() on numeric.
// The only import is ./competencies.js (same package, itself import-free).
import { successProbabilityFor } from "./competencies.js";

/** A score with at most 2 decimals as integer hundredths: 79.31 → 7931, 30 → 3000. */
const toHundredths = (score) => Math.round(score * 100);

// VERA-ALGO[WSM-01] BEGIN Interview score: two-level Weighted Sum Model over the Competency Profile
// Formula: Sₛ = (mean rating of section s − 1) / 4 × 100;  I = Σ wₛ · Sₛ / 100, Σ wₛ = 100        Ref: docs/ALGORITHM.md §4 WSM-01
/**
 * Level 1: each section's score from the mean of its item ratings (1 → 0%, 3 → 50%, 5 → 100%).
 * In hundredths: hₛ = round((Σr − n) × 2500 / n), because (Σr/n − 1) / 4 × 100 × 100 = (Σr − n) × 2500 / n.
 * @param {Record<string, number[]>} ratingsBySection e.g. { A: [5, 4, 4], B: [4, 4, 4, 4, 5, 4, 3, 4, 4], C: [4, 4, 4] }
 * @returns {Record<string, number>} e.g. { A: 83.33, B: 75, C: 75 }
 */
export function sectionScores(ratingsBySection) {
  const scores = {};
  for (const [section, ratings] of Object.entries(ratingsBySection)) {
    const n = ratings.length;
    const sum = ratings.reduce((total, rating) => total + rating, 0);
    scores[section] = Math.round(((sum - n) * 2500) / n) / 100;
  }
  return scores;
}

/**
 * Level 2: the weighted sum of the section scores. Weights are percent (30 = 30%) and total 100.
 * In hundredths: I_h = round(Σ round(wₛ × 100) × hₛ / 10000).
 * @param {Record<string, number>} sectionWeights e.g. { A: 30, B: 30, C: 40 }
 * @param {Record<string, number>} scores from sectionScores
 * @returns {number} 0–100, 2 decimals (worked example: 77.50)
 */
export function interviewScore(sectionWeights, scores) {
  let sum = 0;
  for (const [section, weight] of Object.entries(sectionWeights)) {
    sum += toHundredths(weight) * toHundredths(scores[section]);
  }
  return Math.round(sum / 10000) / 100;
}
// VERA-ALGO[WSM-01] END

// Overall rating (WSM-02): band rule in competencies.js.
/** @returns {number} 1–5, the same value as the final_evaluation.overall_rating generated column */
export function overallRating(interview) {
  return successProbabilityFor(interview).rating;
}

// VERA-ALGO[FIN-01] BEGIN Final score and pass rule
// Formula: final = (matching + interview) / 2, half-up hundredths;  passed = final ≥ passing score        Ref: docs/ALGORITHM.md §4 FIN-01
/**
 * In hundredths: final_h = round((M_h + I_h) / 2). M_h + I_h is an integer, so the halving is exact (… .5 at most)
 * and the rounding is half-up, like the generated column round((matching_score + interview_score) / 2, 2).
 * The applicant type does not appear here: it only changes the matching score (MAT-04).
 */
export function finalScore(matching, interview) {
  return Math.round((toHundredths(matching) + toHundredths(interview)) / 2) / 100;
}

/** BR-07: passed = final ≥ passing score (inclusive), compared in hundredths. */
export function isPassed(final, passingScore) {
  return toHundredths(final) >= toHundredths(passingScore);
}
// VERA-ALGO[FIN-01] END

/**
 * Every number of one evaluation, in pipeline order: section scores → interview → overall rating → final → passed.
 * @param {{ ratingsBySection: Record<string, number[]>, sectionWeights: Record<string, number>,
 *           matchingScore: number, passingScore: number }} input
 */
export function scoreEvaluation({ ratingsBySection, sectionWeights, matchingScore, passingScore }) {
  const scores = sectionScores(ratingsBySection);
  const interview = interviewScore(sectionWeights, scores);
  const final = finalScore(matchingScore, interview);
  return {
    sectionScores: scores,
    interviewScore: interview,
    overallRating: overallRating(interview),
    finalScore: final,
    passed: isPassed(final, passingScore),
  };
}
