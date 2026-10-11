import { APPLICANT_FILTERS, APPLICANT_PAGE_MAX } from "@vera/shared";
import { z } from "zod";

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
