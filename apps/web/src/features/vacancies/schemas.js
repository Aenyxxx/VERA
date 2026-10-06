// Vacancy form (FR-VAC-01, BR-01..03). Mirrors apps/api/src/modules/vacancies/vacancies.schemas.js.
// Inputs hold strings; the transforms produce the API payload. Weights are kept per competency id.
import { EDUCATION_LEVELS, GENDER_REQUIREMENT } from "@vera/shared";
import { z } from "zod";

const text = (label, max) => z.string().trim().min(1, `Enter the ${label}`).max(max);
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const number = (message) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => !Number.isNaN(Number(value)), message)
    .transform(Number);
const optionalNumber = z
  .string()
  .trim()
  .refine((value) => value === "" || !Number.isNaN(Number(value)), "Enter a number")
  .transform((value) => (value === "" ? null : Number(value)));

/** Weights in percent, added in cents so 33.33 + 33.33 + 33.34 = 100 exactly. */
export function weightTotal(weights) {
  return (
    Object.values(weights ?? {}).reduce((sum, value) => {
      const n = Number(value);
      return sum + (value !== "" && !Number.isNaN(n) ? Math.round(n * 100) : 0);
    }, 0) / 100
  );
}

const postingFields = {
  jobTitle: text("job title", 150),
  jobDescription: text("job description", 5000),
  keyResponsibilities: text("key responsibilities", 5000),
  deploymentLocation: optionalText(200),
  employmentType: optionalText(100),
};

export const vacancyFormSchema = z
  .object({
    companyId: z.string().min(1, "Select a company"),
    ...postingFields,
    requiredSkills: text("required skills", 3000),
    experienceRequirement: optionalText(3000),
    minYearsExperience: number("Enter 0 or more"),
    minAge: optionalNumber,
    maxAge: optionalNumber,
    genderRequirement: z.enum(Object.values(GENDER_REQUIREMENT)),
    minEducationLevel: z
      .string()
      .refine((value) => value === "" || EDUCATION_LEVELS.includes(value))
      .transform((value) => value || null),
    minHeightCm: optionalNumber,
    slotsNeeded: number("Enter the number of slots"),
    applicationCap: number("Enter the application cap"),
    endorsementCount: number("Enter the endorsement count"),
    matchingThreshold: number("Enter the matching threshold"),
    passingScore: number("Enter the passing score"),
    weights: z.record(z.string(), z.string()),
  })
  .superRefine((v, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!Number.isInteger(v.slotsNeeded) || v.slotsNeeded < 1) issue("slotsNeeded", "At least 1 slot");
    if (v.minYearsExperience < 0) issue("minYearsExperience", "Use 0 or more");
    if (v.minAge !== null && v.minAge < 15) issue("minAge", "Minimum age is 15");
    if (v.minAge !== null && v.maxAge !== null && v.maxAge < v.minAge) issue("maxAge", "Maximum age must be at least the minimum age");
    if (v.minHeightCm !== null && (v.minHeightCm < 100 || v.minHeightCm > 250)) issue("minHeightCm", "Height must be 100–250 cm");
    if (v.applicationCap < v.slotsNeeded * 4) issue("applicationCap", `Application cap must be at least ${v.slotsNeeded * 4} (slots × 4)`);
    if (v.endorsementCount < v.slotsNeeded) issue("endorsementCount", `Endorsement count must be at least ${v.slotsNeeded} (the number of slots)`);
    if (v.matchingThreshold < 0 || v.matchingThreshold > 100) issue("matchingThreshold", "Use 0–100");
    if (v.passingScore < 0 || v.passingScore > 100) issue("passingScore", "Use 0–100");
    for (const [id, value] of Object.entries(v.weights)) {
      const n = Number(value);
      if (value !== "" && (Number.isNaN(n) || n <= 0 || n > 100)) issue(`weights.${id}`, "Use more than 0 and up to 100");
    }
    const total = weightTotal(v.weights);
    if (total !== 0 && total !== 100) issue("weights", `Weights must total 100%; now ${total}%`);
  });

/** After publishing only posting text and a higher cap (PRD FR-VAC-03). */
export const publishedFormSchema = (currentCap) =>
  z
    .object({ ...postingFields, applicationCap: number("Enter the application cap") })
    .refine((v) => v.applicationCap >= currentCap, {
      path: ["applicationCap"],
      message: `The cap can only be raised (now ${currentCap})`,
    });

/** Form values (strings) → API payload. */
export function toPayload({ weights, ...values }) {
  return {
    ...values,
    competencies: Object.entries(weights)
      .filter(([, weight]) => weight !== "" && Number(weight) > 0)
      .map(([competencyId, weight]) => ({ competencyId, weight: Number(weight) })),
  };
}

const str = (value) => (value === null || value === undefined ? "" : String(value));

/** Defaults for a new vacancy; the cap follows slots × capMultiplier until HR edits it. */
export function newVacancyValues({ matchingThreshold, capMultiplier }) {
  return {
    companyId: "",
    jobTitle: "",
    jobDescription: "",
    keyResponsibilities: "",
    deploymentLocation: "",
    employmentType: "",
    requiredSkills: "",
    experienceRequirement: "",
    minYearsExperience: "0",
    minAge: "",
    maxAge: "",
    genderRequirement: GENDER_REQUIREMENT.ANY,
    minEducationLevel: "",
    minHeightCm: "",
    slotsNeeded: "1",
    applicationCap: str(capMultiplier),
    endorsementCount: "1",
    matchingThreshold: str(matchingThreshold),
    passingScore: "",
    weights: {},
  };
}

/** API vacancy → form values. */
export function toFormValues(vacancy) {
  const keys = Object.keys(newVacancyValues({}));
  const values = Object.fromEntries(keys.filter((k) => k !== "weights").map((k) => [k, str(vacancy[k])]));
  values.weights = Object.fromEntries(vacancy.competencies.map((c) => [c.competencyId, str(c.weight)]));
  return values;
}

export const POSTING_FIELDS = Object.keys(postingFields);
