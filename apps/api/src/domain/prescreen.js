// Prescreen: hard filters on the confirmed profile before any matching (PRD FR-APP-03, DATABASE_SCHEMA §6.1).
// These fields never enter any score. The vacancy page never shows age or gender (RA 10911); the unmet
// condition is named only in the prescreen_failed notification.
import { EDUCATION_LEVEL_LABELS, EDUCATION_LEVELS, GENDER_REQUIREMENT } from "@vera/shared";

// VERA-ALGO[RANK-01] BEGIN Prescreen hard filters (age, gender, education, height)
// Rule: passed = (min_age ≤ age ≤ max_age) ∧ (gender_req = any ∨ gender = gender_req) ∧ (education ≥ min_education) ∧ (height ≥ min_height); an unset condition always passes   Ref: docs/ALGORITHM.md §4 RANK-01
/**
 * @param {{ age: number, gender: string, educationLevel: string, heightCm: number|null }} profile
 * @param {{ minAge: number|null, maxAge: number|null, genderRequirement: string,
 *           minEducationLevel: string|null, minHeightCm: number|null }} vacancy
 * @returns {{ passed: boolean, failedConditions: { condition: string, message: string }[] }}
 */
export function prescreen(profile, vacancy) {
  const failedConditions = [];

  const tooYoung = vacancy.minAge != null && profile.age < vacancy.minAge;
  const tooOld = vacancy.maxAge != null && profile.age > vacancy.maxAge;
  if (tooYoung || tooOld) {
    failedConditions.push({ condition: "age", message: `Age must be ${ageRange(vacancy)} (you are ${profile.age}).` });
  }

  if (vacancy.genderRequirement !== GENDER_REQUIREMENT.ANY && profile.gender !== vacancy.genderRequirement) {
    failedConditions.push({ condition: "gender", message: `This job is for ${vacancy.genderRequirement} applicants only.` });
  }

  // Education levels are ordered lowest → highest, so the index comparison is "at least".
  if (
    vacancy.minEducationLevel != null &&
    EDUCATION_LEVELS.indexOf(profile.educationLevel) < EDUCATION_LEVELS.indexOf(vacancy.minEducationLevel)
  ) {
    failedConditions.push({
      condition: "education",
      message: `Education must be ${EDUCATION_LEVEL_LABELS[vacancy.minEducationLevel].toLowerCase()} or higher.`,
    });
  }

  // A profile without a height cannot show that it meets a minimum height.
  if (vacancy.minHeightCm != null && (profile.heightCm == null || profile.heightCm < vacancy.minHeightCm)) {
    failedConditions.push({
      condition: "height",
      message: `Height must be at least ${vacancy.minHeightCm} cm${profile.heightCm == null ? " (no height in your profile)" : ""}.`,
    });
  }

  return { passed: failedConditions.length === 0, failedConditions };
}
// VERA-ALGO[RANK-01] END

function ageRange({ minAge, maxAge }) {
  if (minAge != null && maxAge != null) return `between ${minAge} and ${maxAge}`;
  return minAge != null ? `at least ${minAge}` : `at most ${maxAge}`;
}
