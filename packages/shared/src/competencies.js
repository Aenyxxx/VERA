// The agency's Competency Profile (interview rubric): 3 sections, 15 items, each rated 1–5.
// Mirrors supabase/migrations/20261007000000_competency_profile_rubric.sql (checked by apps/api/tests/competency-rubric.test.js).
// Scoring: docs/ALGORITHM.md §4 WSM-01 (interview score) and WSM-02 (overall rating of probability of success).

export const COMPETENCY_SECTIONS = Object.freeze([
  Object.freeze({
    code: "A",
    name: "Communication and Interpersonal Skills",
    items: Object.freeze(["Oral Communication/Listening", "Co-Worker Relations/Teamwork", "Customer Relations"]),
  }),
  Object.freeze({
    code: "B",
    name: "Personal Effectiveness Skills and Traits",
    items: Object.freeze([
      "Problem Solving",
      "Time Management",
      "Quality",
      "Initiative and Perseverance",
      "Personal Integrity",
      "Adaptability",
      "Stress Tolerance",
      "Self-Development",
      "Commitment",
    ]),
  }),
  Object.freeze({
    code: "C",
    name: "Job Specific Skills and Experience",
    items: Object.freeze(["Experience", "Education / Training", "Technical Skills"]),
  }),
]);

export const SECTION_CODES = Object.freeze(COMPETENCY_SECTIONS.map((s) => s.code));

/** What each 1–5 item rating means (shown next to the rating buttons in the evaluation form). */
export const RATING_INTERPRETATIONS = Object.freeze({
  1: Object.freeze({ short: "Does not achieve expectations", long: "Major development need" }),
  2: Object.freeze({ short: "Partially achieves expectations", long: "Development need" }),
  3: Object.freeze({ short: "Achieves expectations", long: "Neither strength nor development need" }),
  4: Object.freeze({ short: "Exceeds expectations", long: "Strength" }),
  5: Object.freeze({ short: "Greatly exceeds expectations", long: "Major strength" }),
});

// VERA-ALGO[WSM-02] BEGIN Overall rating of probability of success (band of the interview score)
// Rule: interview ≥ 80 → 5, ≥ 60 → 4, ≥ 40 → 3, ≥ 20 → 2, else 1 (informational; same thresholds as the SQL generated column)   Ref: docs/ALGORITHM.md §4 WSM-02
/**
 * Overall rating of probability of success (WSM-02), from the interview score (0–100).
 * Informational only: it never decides pass/fail (that is final ≥ passing score, FIN-01).
 * Same thresholds as the final_evaluation.overall_rating generated column.
 */
export const SUCCESS_PROBABILITY_BANDS = Object.freeze([
  Object.freeze({ rating: 5, min: 80, label: "High", description: "HIGH — Very good probability of success (80–100%)" }),
  Object.freeze({ rating: 4, min: 60, label: "Good", description: "Good probability of success (60–80%)" }),
  Object.freeze({
    rating: 3,
    min: 40,
    label: "Moderate",
    description: "MODERATE — Moderate probability of success with adequate training and coaching (40–60%)",
  }),
  Object.freeze({
    rating: 2,
    min: 20,
    label: "Poor",
    description: "Poor probability of success; training unlikely to correct problem areas (20–40%)",
  }),
  Object.freeze({
    rating: 1,
    min: 0,
    label: "Low",
    description: "LOW — Very poor probability of success; training extremely unlikely to correct problem areas (0–20%)",
  }),
]);

/** Band for an interview score: 80–100 → 5, 60–<80 → 4, 40–<60 → 3, 20–<40 → 2, 0–<20 → 1. */
export function successProbabilityFor(interviewScore) {
  return SUCCESS_PROBABILITY_BANDS.find((band) => interviewScore >= band.min) ?? SUCCESS_PROBABILITY_BANDS.at(-1);
}
// VERA-ALGO[WSM-02] END
