import { EDUCATION_LEVELS, GENDER_REQUIREMENT, VACANCY_STATUS } from "@vera/shared";
import { z } from "zod";

const text = (label, max) => z.string().trim().min(1, `Enter the ${label}`).max(max);
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);
const optionalNumber = (schema) => schema.nullish().transform((value) => value ?? null);

/** Weights as numeric(5,2): add in cents so 33.33 + 33.33 + 33.34 is exactly 100. */
export const weightTotal = (competencies) =>
  competencies.reduce((sum, c) => sum + Math.round(c.weight * 100), 0) / 100;

// The vacancy's interview rubric (FR-VAC-01): competencies from the fixed list with weights in percent.
// Total 0 (none chosen yet, draft only) or 100 — the DB trigger enforces the same rule at commit.
export const competencyWeightsSchema = z
  .array(
    z.object({
      competencyId: z.uuid("Unknown competency"),
      weight: z.number().gt(0, "Weight must be more than 0").max(100, "Weight must be 100 or less"),
    }),
  )
  .default([])
  .superRefine((list, ctx) => {
    if (new Set(list.map((c) => c.competencyId)).size !== list.length) {
      ctx.addIssue({ code: "custom", message: "Each competency can be used once" });
    }
    const total = weightTotal(list);
    if (total !== 0 && total !== 100) {
      ctx.addIssue({ code: "custom", message: `Weights must total 100%; now ${total}%` });
    }
  });

const postingFields = {
  jobTitle: text("job title", 150),
  jobDescription: text("job description", 5000),
  keyResponsibilities: text("key responsibilities", 5000),
  deploymentLocation: optionalText(200),
  employmentType: optionalText(100),
};

// Full vacancy form, used while the vacancy is a draft (FR-VAC-01, BR-01..03).
// Mirrored in apps/web/src/features/vacancies/schemas.js.
export const vacancySchema = z
  .object({
    companyId: z.uuid("Select a company"),
    ...postingFields,
    requiredSkills: text("required skills", 3000),
    experienceRequirement: optionalText(3000),
    minYearsExperience: z.number().int().min(0, "Use 0 or more").max(50).default(0),
    minAge: optionalNumber(z.number().int().min(15, "Minimum age is 15").max(100)),
    maxAge: optionalNumber(z.number().int().min(15, "Maximum age is at least 15").max(100)),
    genderRequirement: z.enum(Object.values(GENDER_REQUIREMENT)).default(GENDER_REQUIREMENT.ANY),
    minEducationLevel: optionalNumber(z.enum(EDUCATION_LEVELS)),
    minHeightCm: optionalNumber(z.number().min(100, "Height must be 100–250 cm").max(250, "Height must be 100–250 cm")),
    slotsNeeded: z.number().int().min(1, "At least 1 slot").max(999),
    applicationCap: z.number().int().min(1),
    endorsementCount: z.number().int().min(1),
    matchingThreshold: z.number().min(0, "Use 0–100").max(100, "Use 0–100"),
    passingScore: z.number().min(0, "Use 0–100").max(100, "Use 0–100"),
    competencies: competencyWeightsSchema,
  })
  .superRefine((v, ctx) => {
    if (v.minAge !== null && v.maxAge !== null && v.maxAge < v.minAge) {
      ctx.addIssue({ code: "custom", path: ["maxAge"], message: "Maximum age must be at least the minimum age" });
    }
    if (v.applicationCap < v.slotsNeeded * 4) {
      ctx.addIssue({
        code: "custom",
        path: ["applicationCap"],
        message: `Application cap must be at least ${v.slotsNeeded * 4} (slots × 4)`, // BR-02
      });
    }
    if (v.endorsementCount < v.slotsNeeded) {
      ctx.addIssue({
        code: "custom",
        path: ["endorsementCount"],
        message: `Endorsement count must be at least ${v.slotsNeeded} (the number of slots)`, // BR-03
      });
    }
  });

/** After publishing only the posting text and a higher cap may change (PRD FR-VAC-03). */
export const PUBLISHED_EDITABLE_FIELDS = Object.freeze([...Object.keys(postingFields), "applicationCap"]);

export const publishedVacancySchema = z.object({
  ...postingFields,
  applicationCap: z.number().int().min(1),
});

export const reopenSchema = z.object({
  applicationCap: z.number().int().min(1).optional(),
});

export const listVacanciesQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(Object.values(VACANCY_STATUS)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const vacancyIdParams = z.object({ id: z.uuid("Unknown vacancy") });
