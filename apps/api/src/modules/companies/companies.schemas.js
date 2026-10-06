import { z } from "zod";

const required = (label, max) => z.string().trim().min(1, `Enter the ${label}`).max(max);
const optional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

// "kabayanmart.com" → "https://kabayanmart.com"; empty → null.
const website = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((value) => (value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : null))
  .refine((value) => value === null || z.url().safeParse(value).success, "Enter a valid website, e.g. kabayanmart.com");

// Client company (FR-COMP-02): company information + contact person. Mirrored in apps/web/src/features/companies/schemas.js.
export const companySchema = z.object({
  companyName: required("company name", 150),
  industry: required("industry", 100),
  description: optional(2000),
  website,
  contactPersonName: required("contact person's name", 150),
  contactPersonPosition: optional(150),
  contactEmail: z.string().trim().min(1, "Enter the contact email").email("Enter a valid email address"),
  contactNumber: z
    .string()
    .trim()
    .nullish()
    .refine((value) => !value || /^[0-9+()\-\s]{7,20}$/.test(value), "Enter a valid contact number")
    .transform((value) => value || null),
});

export const listCompaniesQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const companyIdParams = z.object({ id: z.uuid("Unknown company") });
