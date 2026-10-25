import { POOL_TABS } from "@vera/shared";
import { z } from "zod";

export const offerParams = z.object({ id: z.uuid("Offer not found") });

export const noBody = z.object({}).optional().default({});

// Applicant Pool tabs (decision 18): Waiting / Returned by Client; no tab = every reason. Decision 37D: `q` searches the
// name or email (blank = no filter).
export const poolQuery = z.object({
  tab: z.enum(Object.keys(POOL_TABS), "Unknown pool tab").optional(),
  q: z
    .string()
    .trim()
    .max(100, "At most 100 characters")
    .optional()
    .transform((value) => value || undefined),
});

// Decision 39-4: the account schema moved to applicants.schemas.js (Applicant Management).
