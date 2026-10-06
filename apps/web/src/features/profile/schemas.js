// Profile card form (FR-PROF-02/04). Mirrors apps/api/src/modules/applicant-profile/applicant-profile.schemas.js;
// inputs hold strings, the transforms produce the API payload (null for empty optional fields).
import { EDUCATION_LEVELS, GENDER } from "@vera/shared";
import { z } from "zod";

import { ageFrom } from "@/lib/format";

const required = (label, max = 100) => z.string().trim().min(1, `Enter your ${label}`).max(max);
const optional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

export const profileSchema = z.object({
  firstName: required("first name"),
  middleName: optional(100),
  lastName: required("last name"),
  suffix: optional(10),
  contactNumber: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9+()\-\s]{7,20}$/.test(value), "Enter a valid contact number")
    .transform((value) => value || null),
  birthdate: z
    .string()
    .min(1, "Enter your birthday")
    .refine(
      (value) => ageFrom(value) !== null && new Date(`${value}T00:00:00`) < new Date(),
      "Your birthday must be in the past",
    ),
  gender: z.enum(Object.values(GENDER), "Select your gender"),
  heightCm: z
    .string()
    .trim()
    .refine((value) => value === "" || (Number(value) >= 100 && Number(value) <= 250), "Height must be 100–250 cm")
    .transform((value) => (value === "" ? null : Number(value))),
  addressLine: required("house number and street", 200),
  city: required("municipality or city"),
  province: required("province"),
  educationLevel: z.enum(EDUCATION_LEVELS, "Select your highest education level"),
});

/** API profile (nulls, numbers) → form values (strings). */
export function toFormValues(profile = {}) {
  const text = (value) => (value === null || value === undefined ? "" : String(value));
  return {
    firstName: text(profile.firstName),
    middleName: text(profile.middleName),
    lastName: text(profile.lastName),
    suffix: text(profile.suffix),
    contactNumber: text(profile.contactNumber),
    birthdate: text(profile.birthdate),
    gender: text(profile.gender),
    heightCm: text(profile.heightCm),
    addressLine: text(profile.addressLine),
    city: text(profile.city),
    province: text(profile.province),
    educationLevel: text(profile.educationLevel),
  };
}
