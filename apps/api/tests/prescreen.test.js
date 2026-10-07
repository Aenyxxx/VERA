// RANK-01 prescreen hard filters (PRD FR-APP-03, DATABASE_SCHEMA §6.1; TC-30).
import { describe, expect, it } from "vitest";

import { prescreen } from "../src/domain/prescreen.js";

// docs/test-cases.md standard vacancy: Cashier, age 18–35, senior high or higher, any gender.
const CASHIER = { minAge: 18, maxAge: 35, genderRequirement: "any", minEducationLevel: "senior_high", minHeightCm: null };
const A1 = { age: 24, gender: "female", educationLevel: "college_graduate", heightCm: 158 };

const conditions = (result) => result.failedConditions.map((c) => c.condition);

describe("prescreen (RANK-01)", () => {
  it("passes an applicant who meets every condition", () => {
    expect(prescreen(A1, CASHIER)).toEqual({ passed: true, failedConditions: [] });
  });

  it("TC-30: fails an applicant aged 40 for max 35 and names the age condition", () => {
    const result = prescreen({ ...A1, age: 40 }, CASHIER);
    expect(result.passed).toBe(false);
    expect(result.failedConditions).toEqual([
      { condition: "age", message: "Age must be between 18 and 35 (you are 40)." },
    ]);
  });

  it("treats the age limits as inclusive", () => {
    expect(prescreen({ ...A1, age: 18 }, CASHIER).passed).toBe(true);
    expect(prescreen({ ...A1, age: 35 }, CASHIER).passed).toBe(true);
    expect(conditions(prescreen({ ...A1, age: 17 }, CASHIER))).toEqual(["age"]);
  });

  it("describes one-sided age limits", () => {
    expect(prescreen({ ...A1, age: 16 }, { ...CASHIER, maxAge: null }).failedConditions[0].message).toBe(
      "Age must be at least 18 (you are 16).",
    );
    expect(prescreen({ ...A1, age: 50 }, { ...CASHIER, minAge: null }).failedConditions[0].message).toBe(
      "Age must be at most 35 (you are 50).",
    );
  });

  it("checks the gender requirement only when it is not 'any'", () => {
    expect(prescreen(A1, { ...CASHIER, genderRequirement: "female" }).passed).toBe(true);
    expect(conditions(prescreen(A1, { ...CASHIER, genderRequirement: "male" }))).toEqual(["gender"]);
  });

  it("compares education levels in their order (at least the minimum)", () => {
    expect(prescreen({ ...A1, educationLevel: "senior_high" }, CASHIER).passed).toBe(true);
    expect(prescreen({ ...A1, educationLevel: "vocational" }, CASHIER).passed).toBe(true);
    const result = prescreen({ ...A1, educationLevel: "junior_high" }, CASHIER);
    expect(result.failedConditions).toEqual([
      { condition: "education", message: "Education must be senior high school or higher." },
    ]);
  });

  it("fails a minimum height when the profile is shorter or has no height", () => {
    const tall = { ...CASHIER, minHeightCm: 160 };
    expect(prescreen({ ...A1, heightCm: 160 }, tall).passed).toBe(true);
    expect(conditions(prescreen({ ...A1, heightCm: 158 }, tall))).toEqual(["height"]);
    expect(prescreen({ ...A1, heightCm: null }, tall).failedConditions[0].message).toBe(
      "Height must be at least 160 cm (no height in your profile).",
    );
  });

  it("passes everything when the vacancy sets no conditions", () => {
    const none = { minAge: null, maxAge: null, genderRequirement: "any", minEducationLevel: null, minHeightCm: null };
    expect(prescreen({ age: 60, gender: "male", educationLevel: "elementary", heightCm: null }, none).passed).toBe(true);
  });

  it("lists every unmet condition", () => {
    const strict = { ...CASHIER, genderRequirement: "male", minHeightCm: 170 };
    expect(conditions(prescreen({ ...A1, age: 40, educationLevel: "elementary" }, strict))).toEqual([
      "age",
      "gender",
      "education",
      "height",
    ]);
  });
});
