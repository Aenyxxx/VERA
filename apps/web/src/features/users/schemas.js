import { PASSWORD_HINT, PASSWORD_PATTERN } from "@vera/shared";
import { z } from "zod";

// Add HR account (FR-AUTH-07): the same rules as the API (users.schemas.js); the role is always HR.
export const createHrSchema = z.object({
  email: z.string().trim().min(1, "Enter the email address").email("Enter a valid email address"),
  fullName: z.string().trim().min(1, "Enter the full name").max(120, "At most 120 characters"),
  temporaryPassword: z.string().regex(PASSWORD_PATTERN, PASSWORD_HINT),
});
