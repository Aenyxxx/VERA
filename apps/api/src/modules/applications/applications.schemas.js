import { APPLICANT_TYPE } from "@vera/shared";
import { z } from "zod";

// Apply dialog: one required radio button (PRD FR-APP-02); the stored profile and resume are used. Decision 16: the
// applicant may also attach some of their current supporting documents (optional; verification stays per document).
export const applySchema = z.object({
  vacancyId: z.uuid("This job is no longer open."),
  applicantType: z.enum(Object.values(APPLICANT_TYPE), { error: "Choose First-time job seeker or Experienced." }),
  attachDocumentIds: z
    .array(z.uuid("Choose from your current documents."))
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Choose each document once.")
    .default([]),
});
