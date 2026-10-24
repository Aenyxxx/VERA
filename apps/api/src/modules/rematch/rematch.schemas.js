import { ACCOUNT_STATUS, POOL_TABS } from "@vera/shared";
import { z } from "zod";

export const offerParams = z.object({ id: z.uuid("Offer not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });
export const poolEntryParams = z.object({ talentPoolId: z.uuid("Applicant pool entry not found") });

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

// Decision 37D: activate or deactivate the applicant's account; a reason (HR only) is required to deactivate.
export const accountSchema = z
  .object({
    accountStatus: z.enum(Object.values(ACCOUNT_STATUS), { error: "Choose active or inactive." }),
    reason: z.string().trim().max(500, "At most 500 characters").optional(),
  })
  .superRefine((body, ctx) => {
    if (body.accountStatus === ACCOUNT_STATUS.INACTIVE && (body.reason ?? "").length < 5) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Write the reason (at least 5 characters)." });
    }
  });
