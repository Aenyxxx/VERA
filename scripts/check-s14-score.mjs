// Helper for scripts/check-s14.ps1: prints the JS scores (packages/shared/src/scoring.js) for one evaluation, so
// the check can compare the values stored by the API and the database with the JS values.
// Input: env S14_SCORE_INPUT = JSON { ratingsBySection, sectionWeights, matchingScore, passingScore }.
// Output: one JSON line { sectionScores, interviewScore, overallRating, finalScore, passed }. Read-only.
import { scoreEvaluation } from "../packages/shared/src/scoring.js";

const input = JSON.parse(process.env.S14_SCORE_INPUT ?? "null");
if (!input) {
  console.error("Set S14_SCORE_INPUT to a JSON object.");
  process.exit(2);
}
console.log(JSON.stringify(scoreEvaluation(input)));
