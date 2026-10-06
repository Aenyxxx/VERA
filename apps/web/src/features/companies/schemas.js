// Company form (FR-COMP-02). Mirrors apps/api/src/modules/companies/companies.schemas.js;
// inputs hold strings, the transforms produce the API payload (null for empty optional fields).
import { z } from "zod";

const required = (label, max) => z.string().trim().min(1, `Enter the ${label}`).max(max);
const optional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

export const companySchema = z.object({
  companyName: required("company name", 150),
  industry: required("industry", 100),
  description: optional(2000),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((value) => (value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : null))
    .refine((value) => value === null || z.url().safeParse(value).success, "Enter a valid website, e.g. kabayanmart.com"),
  contactPersonName: required("contact person's name", 150),
  contactPersonPosition: optional(150),
  contactEmail: z.string().trim().min(1, "Enter the contact email").email("Enter a valid email address"),
  contactNumber: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9+()\-\s]{7,20}$/.test(value), "Enter a valid contact number")
    .transform((value) => value || null),
});

export const EMPTY_COMPANY = {
  companyName: "",
  industry: "",
  description: "",
  website: "",
  contactPersonName: "",
  contactPersonPosition: "",
  contactEmail: "",
  contactNumber: "",
};

/** API company (nulls) → form values (strings). */
export function toFormValues(company) {
  if (!company) return EMPTY_COMPANY;
  return Object.fromEntries(Object.keys(EMPTY_COMPANY).map((key) => [key, company[key] ?? ""]));
}
