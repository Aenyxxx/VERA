import { EDUCATION_LEVELS, GENDER } from "@vera/shared";
import { z } from "zod";

const required = (label, max = 100) => z.string().trim().min(1, `Enter your ${label}`).max(max);
const optional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

// The profile card, used by confirm (FR-PROF-04) and edit (FR-PROF-05). Email is not part of it: it is the login.
// Mirrored in apps/web/src/features/profile/schemas.js.
export const profileSchema = z.object({
  firstName: required("first name"),
  middleName: optional(100),
  lastName: required("last name"),
  suffix: optional(10),
  contactNumber: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid contact number")
    .nullish()
    .or(z.literal(""))
    .transform((value) => value || null),
  birthdate: z.iso
    .date("Enter your birthday")
    .refine((value) => new Date(`${value}T00:00:00`) < new Date(), "Your birthday must be in the past"),
  gender: z.enum(Object.values(GENDER), "Select your gender"),
  heightCm: z.number().min(100, "Height must be 100–250 cm").max(250, "Height must be 100–250 cm").nullish(),
  addressLine: required("house number and street", 200),
  city: required("municipality or city"),
  province: required("province"),
  educationLevel: z.enum(EDUCATION_LEVELS, "Select your highest education level"),
});
