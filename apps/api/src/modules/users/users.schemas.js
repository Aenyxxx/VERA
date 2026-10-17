import { ACCOUNT_STATUS, PASSWORD_HINT, PASSWORD_PATTERN } from "@vera/shared";
import { z } from "zod";

export const userIdParams = z.object({ id: z.uuid("Staff account not found.") });

// FR-AUTH-07: email, full name, temporary password (FR-AUTH-02 rule). The role is always hr (decision 19).
export const createHrSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter the email address.").max(254).email("Enter a valid email address."),
  fullName: z.string().trim().min(1, "Enter the full name.").max(120),
  temporaryPassword: z.string().regex(PASSWORD_PATTERN, PASSWORD_HINT).max(72),
});

export const accountStatusSchema = z.object({
  accountStatus: z.enum(Object.values(ACCOUNT_STATUS), { error: "Choose active or inactive." }),
});
