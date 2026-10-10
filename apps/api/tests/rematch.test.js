// Rematch ranking after a client rejection (RANK-04; PRD BR-23, FR-END-10; ALGORITHM.md §4 RANK-04, §6): keep
// M ≥ threshold and F ≥ passing of that vacancy; order M DESC, F DESC, vacancy_id ASC; rank 1 is offered.
import { finalScore, scoreEvaluation } from "@vera/shared";
import { describe, expect, it } from "vitest";

import { compareRematch, excludedReason, rankRematch } from "../src/domain/rematch.js";

const candidate = (vacancyId, matchingScore, finalScore, extra = {}) => ({
  vacancyId,
  matchingScore,
  finalScore,
  matchingThreshold: 40,
  passingScore: 75,
  ...extra,
});
const order = (candidates) => rankRematch(candidates).map((c) => [c.rank, c.vacancyId]);

describe("RANK-04 excludedReason", () => {
  it("keeps a vacancy at or above both limits (equal counts)", () => {
    expect(excludedReason(candidate("v", 40, 75))).toBe(null);
    expect(excludedReason(candidate("v", 71.15, 77.24))).toBe(null);
  });

  it("below the vacancy's matching threshold → below_threshold (checked first)", () => {
    expect(excludedReason(candidate("v", 39.99, 90))).toBe("below_threshold");
    expect(excludedReason(candidate("v", 39.99, 50))).toBe("below_threshold");
  });

  it("below the vacancy's passing score → below_passing", () => {
    expect(excludedReason(candidate("v", 85, 74.99))).toBe("below_passing");
    expect(excludedReason(candidate("v", 99.38, 89.69, { passingScore: 100 }))).toBe("below_passing");
  });
});

describe("RANK-04 rankRematch", () => {
  it("higher matching first, even with a lower final", () => {
    expect(order([candidate("b", 80, 90), candidate("a", 85, 80)])).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("equal matching: the higher final first", () => {
    expect(order([candidate("a", 80, 78.34), candidate("b", 80, 82.5)])).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });

  it("equal matching and final: the lower vacancy id first (deterministic)", () => {
    const low = "11111111-0000-4000-8000-000000000001";
    const high = "22222222-0000-4000-8000-000000000002";
    expect(order([candidate(high, 80, 80), candidate(low, 80, 80)])).toEqual([
      [1, low],
      [2, high],
    ]);
  });

  it("leaves out excluded vacancies and ranks the rest; nothing kept → empty list", () => {
    const ranked = rankRematch([
      candidate("below-threshold", 35, 90),
      candidate("ok", 71.15, 77.24),
      candidate("below-passing", 85, 72.4),
    ]);
    expect(ranked).toEqual([{ rank: 1, ...candidate("ok", 71.15, 77.24) }]);
    expect(rankRematch([candidate("x", 85, 72.4)])).toEqual([]);
    expect(rankRematch([])).toEqual([]);
  });

  it("ALGORITHM §6: the M 85.00 / F 72.40 vacancy is excluded; Store Crew is rank 1", () => {
    expect(order([candidate("other", 85, 72.4), candidate("store-crew", 80, 78.34)])).toEqual([[1, "store-crew"]]);
  });

  it("does not change the input order", () => {
    const input = [candidate("b", 80, 80), candidate("a", 90, 80)];
    rankRematch(input);
    expect(input.map((c) => c.vacancyId)).toEqual(["b", "a"]);
  });

  it("compareRematch: negative when a ranks first", () => {
    expect(compareRematch(candidate("a", 90, 80), candidate("b", 80, 90))).toBeLessThan(0);
    expect(compareRematch(candidate("a", 80, 80), candidate("b", 80, 80))).toBeLessThan(0);
    expect(compareRematch(candidate("b", 80, 80), candidate("a", 80, 80))).toBeGreaterThan(0);
  });
});

describe("Juan's demo rematch (ALGORITHM §6): Cashier not_hired → Store Crew", () => {
  // Juan's demo ratings, scored with Store Crew's section weights (A 20 / B 80 / C 0) through WSM-03.
  const ratingsBySection = { A: [5, 4, 4], B: [5, 5, 5, 4, 4, 4, 4, 4, 4], C: [4, 4, 4] };

  it("Store Crew: matching 71.15, interview 83.33, final 77.24 → kept and offered", () => {
    const scores = scoreEvaluation({
      ratingsBySection,
      sectionWeights: { A: 20, B: 80, C: 0 },
      matchingScore: 71.15,
      passingScore: 75,
    });
    expect(scores.interviewScore).toBe(83.33);
    expect(scores.finalScore).toBe(77.24);
    expect(finalScore(71.15, 83.33)).toBe(77.24);

    const ranked = rankRematch([candidate("store-crew", 71.15, scores.finalScore)]);
    expect(ranked).toEqual([{ rank: 1, ...candidate("store-crew", 71.15, 77.24) }]);
  });

  it("a vacancy built from the Cashier requirements (matching 99.38) outranks Store Crew (71.15)", () => {
    const zz = scoreEvaluation({ ratingsBySection, sectionWeights: { A: 30, B: 30, C: 40 }, matchingScore: 99.38, passingScore: 75 });
    expect(zz.finalScore).toBe(89.69);
    expect(order([candidate("store-crew", 71.15, 77.24), candidate("zz-best", 99.38, zz.finalScore)])).toEqual([
      [1, "zz-best"],
      [2, "store-crew"],
    ]);
  });
});
