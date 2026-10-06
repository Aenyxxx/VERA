import { z } from "zod";

// Login only checks that both fields are filled in; the password rules (FR-AUTH-02) apply at sign-up.
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});
