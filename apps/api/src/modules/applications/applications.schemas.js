import { APPLICANT_TYPE } from "@vera/shared";
import { z } from "zod";

// Apply dialog: one required radio button (PRD FR-APP-02). Nothing else is sent; the stored profile and resume are used.
export const applySchema = z.object({
  vacancyId: z.uuid("This job is no longer open."),
  applicantType: z.enum(Object.values(APPLICANT_TYPE), { error: "Choose First-time job seeker or Experienced." }),
});
