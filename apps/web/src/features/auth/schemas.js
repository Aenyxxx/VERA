import { z } from "zod";

// FR-AUTH-02: at least 8 characters, at least 1 letter and 1 number.
export const PASSWORD_RULE = "At least 8 characters with a letter and a number";

export const signUpSchema = z
  .object({
    email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, PASSWORD_RULE)
      .regex(/[A-Za-z]/, PASSWORD_RULE)
      .regex(/\d/, PASSWORD_RULE),
    confirmPassword: z.string().min(1, "Confirm your password"),
    consent: z.literal(true, "You must agree before creating an account"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// Login only checks that both fields are filled in; the password rules (FR-AUTH-02) apply at sign-up.
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});
