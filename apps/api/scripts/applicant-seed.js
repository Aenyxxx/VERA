// Helpers for `pnpm --filter api seed:applicant` (kept apart from seed-applicant.js so tests need no Supabase).
import { ROLES } from "@vera/shared";
import { z } from "zod";

/** Marks consent recorded by the seed, so it is never mistaken for a real applicant's consent (RA 10173). */
export const CONSENT_SOURCE = "seed:applicant (demo account)";

// FR-AUTH-02: at least 8 characters, at least 1 letter and 1 number (same rule as seed:admin and sign-up).
export const passwordSchema = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, "must be 8+ characters with at least 1 letter and 1 number");

/** `--email a@b.c` or `--email=a@b.c` from the command line → the email, or throws a readable error. */
export function parseEmailArg(argv) {
  const inline = argv.find((arg) => arg.startsWith("--email="));
  const index = argv.indexOf("--email");
  const value = inline ? inline.slice("--email=".length) : index >= 0 ? argv[index + 1] : undefined;
  const parsed = z.email().safeParse(value?.trim());
  if (!parsed.success) throw new Error("Pass the demo applicant's email: pnpm --filter api seed:applicant -- --email demo1@vera.test");
  return parsed.data.toLowerCase();
}

/**
 * user_metadata with the seed's consent record, or null when consent is already recorded (never overwritten:
 * a real sign-up's privacy_consent_at stays as it is).
 */
export function consentMetadata(existing = {}, now = new Date()) {
  if (existing?.privacy_consent_at) return null;
  return { ...existing, privacy_consent_at: now.toISOString(), privacy_consent_source: CONSENT_SOURCE };
}

/** The seed only creates or repairs applicants; it never changes an admin or HR account. */
export function assertNotStaff({ accountRole, appMetadataRole }) {
  const staff = [ROLES.ADMIN, ROLES.HR];
  if (staff.includes(accountRole) || staff.includes(appMetadataRole)) {
    throw new Error("This email belongs to a staff account; seed:applicant never changes admin or HR accounts.");
  }
}
