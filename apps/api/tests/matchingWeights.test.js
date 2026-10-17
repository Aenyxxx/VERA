// MAT-04 weights by applicant type, skills only when the vacancy has no experience criterion (@vera/shared).
// Decision 11 (Oct 13, 2026): no minimum years; the criterion is the experience text alone.
import { MATCHING_WEIGHTS, resolveMatchingWeights } from "@vera/shared";
import { describe, expect, it } from "vitest";

const SKILLS_ONLY = { skills: 1, experience: 0 };
const HALF_HALF = { skills: 0.5, experience: 0.5 };
const job = (experienceRequirement) => ({ experienceRequirement });

describe("resolveMatchingWeights (MAT-04)", () => {
  it("keeps the BR-04 weights: first-time 1/0, experienced 0.5/0.5", () => {
    expect(MATCHING_WEIGHTS).toEqual({ first_time: SKILLS_ONLY, experienced: HALF_HALF });
  });

  it("experienced on a job with experience text keeps 0.5/0.5", () => {
    expect(resolveMatchingWeights("experienced", job("Cashier in a supermarket"))).toEqual(HALF_HALF);
  });

  it.each([
    ["null text", null],
    ["undefined text", undefined],
    ["empty text", ""],
    ["whitespace only", "  \n\t "],
  ])("experienced on a job with no experience criterion (%s) gets skills only", (_label, text) => {
    expect(resolveMatchingWeights("experienced", job(text))).toEqual(SKILLS_ONLY);
  });

  it("ignores a minimum years value from an old row: blank text is skills only, text is 0.5/0.5", () => {
    expect(resolveMatchingWeights("experienced", { experienceRequirement: "", minYearsExperience: 2 })).toEqual(SKILLS_ONLY);
    expect(resolveMatchingWeights("experienced", { experienceRequirement: null, minYearsExperience: 1 })).toEqual(SKILLS_ONLY);
    expect(resolveMatchingWeights("experienced", { experienceRequirement: "Cashier", minYearsExperience: 0 })).toEqual(HALF_HALF);
  });

  it("first-time is always skills only", () => {
    expect(resolveMatchingWeights("first_time", job("Cashier in a supermarket"))).toEqual(SKILLS_ONLY);
    expect(resolveMatchingWeights("first_time", job(null))).toEqual(SKILLS_ONLY);
  });
});
