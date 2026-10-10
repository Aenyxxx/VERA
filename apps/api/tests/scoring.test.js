// Interview and final scores (docs/ALGORITHM.md §4 WSM-01, WSM-02, FIN-01, §6 worked example; TC-48, TC-49, TC-78).
// The formulas are in @vera/shared scoring.js; domain/scoring.js checks the 15 ratings and calls them.
import {
  COMPETENCY_SECTIONS,
  finalScore,
  interviewScore,
  isPassed,
  overallRating,
  scoreEvaluation,
  sectionScores,
} from "@vera/shared";
import { describe, expect, it } from "vitest";

import { buildEvaluation } from "../src/domain/scoring.js";

// ALGORITHM.md §6: A = 5, 4, 4 · B = 4, 4, 4, 4, 5, 4, 3, 4, 4 · C = 4, 4, 4
const WORKED = { A: [5, 4, 4], B: [4, 4, 4, 4, 5, 4, 3, 4, 4], C: [4, 4, 4] };
const CASHIER = { A: 30, B: 30, C: 40 };
const STORE_CREW = { A: 20, B: 80, C: 0 };

describe("WSM-01 section scores (level 1)", () => {
  it("worked example: A 83.33, B 75.00, C 75.00 (hundredths 8333.3 → 8333)", () => {
    expect(sectionScores(WORKED)).toEqual({ A: 83.33, B: 75, C: 75 });
  });

  it("1 → 0%, 3 → 50%, 5 → 100%", () => {
    expect(sectionScores({ A: [1, 1, 1], B: [3, 3, 3], C: [5, 5, 5] })).toEqual({ A: 0, B: 50, C: 100 });
  });
});

describe("WSM-01 interview score (level 2)", () => {
  it("worked example on Cashier (A 30 / B 30 / C 40): 77.50 (hundredths 7749.9 → 7750)", () => {
    expect(interviewScore(CASHIER, sectionScores(WORKED))).toBe(77.5);
  });

  it("rating reuse on Store Crew (A 20 / B 80 / C 0): 76.67 (hundredths 7666.6 → 7667; TC-78)", () => {
    expect(interviewScore(STORE_CREW, sectionScores(WORKED))).toBe(76.67);
  });

  it("a 0% section with ratings present counts nothing and gives no NaN", () => {
    const score = interviewScore({ A: 20, B: 80, C: 0 }, sectionScores({ A: [5, 5, 5], B: [3, 3, 3, 3, 3, 3, 3, 3, 3], C: [1, 1, 1] }));
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(60); // 20 × 100% + 80 × 50% + 0 × 0%
  });

  it("rounds half up in exact hundredths: 50 × 83.33 + 50 × 75 → 7916.5 → 79.17", () => {
    expect(interviewScore({ A: 50, B: 50, C: 0 }, { A: 83.33, B: 75, C: 75 })).toBe(79.17);
  });
});

describe("WSM-02 overall rating of probability of success", () => {
  it("worked example 77.50 → 4", () => {
    expect(overallRating(77.5)).toBe(4);
  });

  it("band edges: 79.99 → 4, 80.00 → 5, 60.00 → 4, 59.99 → 3, 0 → 1", () => {
    expect(overallRating(79.99)).toBe(4);
    expect(overallRating(80)).toBe(5);
    expect(overallRating(60)).toBe(4);
    expect(overallRating(59.99)).toBe(3);
    expect(overallRating(0)).toBe(1);
  });

  it("matches the SQL generated column at every threshold (80 / 60 / 40 / 20)", () => {
    const sqlBand = (s) => (s >= 80 ? 5 : s >= 60 ? 4 : s >= 40 ? 3 : s >= 20 ? 2 : 1);
    for (const s of [0, 19.99, 20, 39.99, 40, 59.99, 60, 79.99, 80, 100]) expect(overallRating(s)).toBe(sqlBand(s));
  });
});

describe("FIN-01 final score and pass rule", () => {
  it("worked example: experienced (79.31 + 77.50) / 2 = 7840.5 → 78.41; first-time (87.50 + 77.50) / 2 = 82.50", () => {
    expect(finalScore(79.31, 77.5)).toBe(78.41);
    expect(finalScore(87.5, 77.5)).toBe(82.5);
  });

  it("reuse: (80.00 + 76.67) / 2 = 7833.5 → 78.34 from the stored, rounded interview hundredths (TC-78)", () => {
    expect(finalScore(80, 76.67)).toBe(78.34);
  });

  it("half-up on the decimal value, not the binary float: (39.99 + 40) / 2 → 40.00; (0.01 + 0) / 2 → 0.01", () => {
    expect(finalScore(39.99, 40)).toBe(40);
    expect(finalScore(0.01, 0)).toBe(0.01);
  });

  it("passed = final ≥ passing score (inclusive, PRD BR-07)", () => {
    expect(isPassed(75, 75)).toBe(true);
    expect(isPassed(74.99, 75)).toBe(false);
    expect(isPassed(78.41, 75)).toBe(true);
  });
});

describe("scoreEvaluation (all steps in order)", () => {
  it("worked example, experienced on Cashier: 83.33 / 75 / 75 → 77.50, rating 4, final 78.41, passed (TC-48)", () => {
    expect(scoreEvaluation({ ratingsBySection: WORKED, sectionWeights: CASHIER, matchingScore: 79.31, passingScore: 75 })).toEqual({
      sectionScores: { A: 83.33, B: 75, C: 75 },
      interviewScore: 77.5,
      overallRating: 4,
      finalScore: 78.41,
      passed: true,
    });
  });

  it("worked example, first-time on Cashier: final 82.50 (applicant type only changes matching, MAT-04)", () => {
    expect(scoreEvaluation({ ratingsBySection: WORKED, sectionWeights: CASHIER, matchingScore: 87.5, passingScore: 75 }).finalScore).toBe(82.5);
  });

  // Demo script §5 step 8 with Juan's real matching scores (pinned so the rehearsal numbers never drift).
  describe("Juan demo ratings: A 5,4,4 · B 5,5,5,4,4,4,4,4,4 · C 4,4,4", () => {
    const JUAN = { A: [5, 4, 4], B: [5, 5, 5, 4, 4, 4, 4, 4, 4], C: [4, 4, 4] };

    it("sections 83.33 / 83.33 / 75.00", () => {
      expect(sectionScores(JUAN)).toEqual({ A: 83.33, B: 83.33, C: 75 });
    });

    it("Cashier (A 30 / B 30 / C 40), matching 99.38: interview 80.00 (7999.8 → 8000), rating 5, final 89.69, passed at 75", () => {
      expect(scoreEvaluation({ ratingsBySection: JUAN, sectionWeights: CASHIER, matchingScore: 99.38, passingScore: 75 })).toEqual({
        sectionScores: { A: 83.33, B: 83.33, C: 75 },
        interviewScore: 80,
        overallRating: 5,
        finalScore: 89.69,
        passed: true,
      });
    });

    it("Store Crew (A 20 / B 80 / C 0), matching 71.15: interview 83.33 (≥ 80.85), final 77.24 (≥ 76.00), passed at 75", () => {
      const result = scoreEvaluation({ ratingsBySection: JUAN, sectionWeights: STORE_CREW, matchingScore: 71.15, passingScore: 75 });
      expect(result).toEqual({
        sectionScores: { A: 83.33, B: 83.33, C: 75 },
        interviewScore: 83.33,
        overallRating: 5,
        finalScore: 77.24,
        passed: true,
      });
      expect(result.interviewScore).toBeGreaterThanOrEqual(80.85);
      expect(result.finalScore).toBeGreaterThanOrEqual(76);
    });
  });
});

// ---------------------------------------------------------------- domain/scoring.js (API side)

// The active rubric as listRubric returns it, with readable ids: A1..A3, B1..B9, C1..C3.
const RUBRIC = COMPETENCY_SECTIONS.map((s) => ({
  sectionCode: s.code,
  items: s.items.map((_, i) => ({ competencyId: `${s.code}${i + 1}` })),
}));
const WEIGHTS = [
  { sectionCode: "A", weight: 30 },
  { sectionCode: "B", weight: 30 },
  { sectionCode: "C", weight: 40 },
];
const ratingsFor = (bySection) =>
  Object.entries(bySection).flatMap(([code, list]) => list.map((rating, i) => ({ competencyId: `${code}${i + 1}`, rating })));
const build = (overrides = {}) =>
  buildEvaluation({ rubric: RUBRIC, ratings: ratingsFor(WORKED), sectionWeights: WEIGHTS, matchingScore: 79.31, passingScore: 75, ...overrides });

describe("buildEvaluation (server-side check + recompute)", () => {
  it("scores the 15 ratings in any order (TC-48)", () => {
    expect(build({ ratings: ratingsFor(WORKED).reverse() })).toMatchObject({ interviewScore: 77.5, finalScore: 78.41, passed: true });
  });

  it("accepts pg strings for numbers (numeric and smallint columns)", () => {
    const stringy = ratingsFor(WORKED).map((r) => ({ ...r, rating: String(r.rating) }));
    expect(build({ ratings: stringy, matchingScore: "79.31", passingScore: "75.00", sectionWeights: WEIGHTS.map((w) => ({ ...w, weight: `${w.weight}.00` })) }))
      .toMatchObject({ interviewScore: 77.5, finalScore: 78.41 });
  });

  it("one item unrated → 422, nothing scored (TC-49)", () => {
    expect(() => build({ ratings: ratingsFor(WORKED).slice(1) })).toThrow(/Rate each of the 15 Competency Profile items once/);
  });

  it("an item rated twice, or an unknown item → 422", () => {
    const ratings = ratingsFor(WORKED);
    expect(() => build({ ratings: [...ratings.slice(1), ratings[1]] })).toThrow(/Rate each of the 15/);
    expect(() => build({ ratings: [...ratings.slice(1), { competencyId: "X1", rating: 4 }] })).toThrow(/Rate each of the 15/);
  });

  it("ratings outside 1–5 or not whole → 422", () => {
    for (const bad of [0, 6, 2.5]) {
      const ratings = ratingsFor(WORKED);
      ratings[0] = { ...ratings[0], rating: bad };
      expect(() => build({ ratings })).toThrow(/whole number from 1 to 5/);
    }
  });

  it("section weights not totalling 100 → 422", () => {
    expect(() => build({ sectionWeights: WEIGHTS.map((w) => ({ ...w, weight: w.sectionCode === "C" ? 30 : w.weight })) })).toThrow(/total 100%/);
  });

  it("a missing section weight, or a section code not in the rubric → 422", () => {
    expect(() => build({ sectionWeights: [{ sectionCode: "A", weight: 30 }, { sectionCode: "B", weight: 70 }] })).toThrow(/do not match/);
    expect(() => build({ sectionWeights: [...WEIGHTS.slice(0, 2), { sectionCode: "D", weight: 40 }] })).toThrow(/do not match/);
    expect(() => build({ sectionWeights: [...WEIGHTS, { sectionCode: "D", weight: 0 }] })).toThrow(/do not match/);
  });

  it("no matching score → 422 (never scored as 0)", () => {
    expect(() => build({ matchingScore: null })).toThrow(/no matching score/);
  });

  it("the incomplete message can name the earlier evaluation (reuse)", () => {
    expect(() => build({ ratings: [], incompleteMessage: "The earlier evaluation does not have all Competency Profile ratings." }))
      .toThrow(/earlier evaluation/);
  });
});
