// MAT-04 weights by applicant type, skills only when the vacancy has no experience criterion (@vera/shared).
import { MATCHING_WEIGHTS, resolveMatchingWeights } from "@vera/shared";
import { describe, expect, it } from "vitest";

const SKILLS_ONLY = { skills: 1, experience: 0 };
const HALF_HALF = { skills: 0.5, experience: 0.5 };
const job = (experienceRequirement, minYearsExperience) => ({ experienceRequirement, minYearsExperience });

describe("resolveMatchingWeights (MAT-04)", () => {
  it("keeps the BR-04 weights: first-time 1/0, experienced 0.5/0.5", () => {
    expect(MATCHING_WEIGHTS).toEqual({ first_time: SKILLS_ONLY, experienced: HALF_HALF });
  });

  it("experienced on a job with experience text keeps 0.5/0.5", () => {
    expect(resolveMatchingWeights("experienced", job("Cashier in a supermarket", 0))).toEqual(HALF_HALF);
    expect(resolveMatchingWeights("experienced", job("Cashier in a supermarket", 1))).toEqual(HALF_HALF);
  });

  it("experienced on a job with min years > 0 but blank text keeps 0.5/0.5", () => {
    expect(resolveMatchingWeights("experienced", job("", 2))).toEqual(HALF_HALF);
    expect(resolveMatchingWeights("experienced", job(null, 1))).toEqual(HALF_HALF);
  });

  it.each([
    ["null text", null],
    ["empty text", ""],
    ["whitespace only", "  \n\t "],
  ])("experienced on a job with no experience criterion (%s, 0 years) gets skills only", (_label, text) => {
    expect(resolveMatchingWeights("experienced", job(text, 0))).toEqual(SKILLS_ONLY);
  });

  it("first-time is always skills only", () => {
    expect(resolveMatchingWeights("first_time", job("Cashier in a supermarket", 1))).toEqual(SKILLS_ONLY);
    expect(resolveMatchingWeights("first_time", job(null, 0))).toEqual(SKILLS_ONLY);
  });
});
