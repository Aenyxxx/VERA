import { PASSWORD_HINT, PASSWORD_PATTERN } from "@vera/shared";
import { z } from "zod";

const passwordsMatch = { path: ["confirmPassword"], message: "Passwords do not match" };

// Add HR account (FR-AUTH-07): the same rules as the API (users.schemas.js); the role is always HR. The confirm field is
// checked here only; the API receives one password (Oct 19 change 1a).
export const createHrSchema = z
  .object({
    email: z.string().trim().min(1, "Enter the email address").email("Enter a valid email address"),
    fullName: z.string().trim().min(1, "Enter the full name").max(120, "At most 120 characters"),
    temporaryPassword: z.string().regex(PASSWORD_PATTERN, PASSWORD_HINT),
    confirmPassword: z.string().min(1, "Confirm the password"),
  })
  .refine((values) => values.temporaryPassword === values.confirmPassword, passwordsMatch);

// Edit a staff account (Oct 19 change 1b): full name, and a new password only when one is typed (blank keeps it).
export const editStaffSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter the full name").max(120, "At most 120 characters"),
    password: z.union([z.literal(""), z.string().regex(PASSWORD_PATTERN, PASSWORD_HINT)]),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, passwordsMatch);
