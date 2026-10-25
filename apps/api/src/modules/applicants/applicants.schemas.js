import { ACCOUNT_STATUS, APPLICANT_FILTERS, APPLICANT_PAGE_MAX } from "@vera/shared";
import { z } from "zod";

export const applicantParams = z.object({ applicantId: z.uuid("Applicant not found") });

// Decision 39-4 (moved from the Applicant Pool, decision 37D): activate or deactivate the applicant's account; a reason
// (HR only) is required to deactivate.
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

// GET /api/admin/applicants (S18, FR-ADM-02). pageSize above the server cap is clamped, not refused.
export const listApplicantsQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(APPLICANT_FILTERS, "Unknown status filter").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, APPLICANT_PAGE_MAX)),
});
