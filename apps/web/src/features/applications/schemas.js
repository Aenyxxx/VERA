// Apply dialog (PRD FR-APP-02). Mirrors apps/api/src/modules/applications/applications.schemas.js.
import { APPLICANT_TYPE } from "@vera/shared";
import { z } from "zod";

export const applySchema = z.object({
  applicantType: z.enum(Object.values(APPLICANT_TYPE), { error: "Choose First-time job seeker or Experienced." }),
  // Decision 16: optional, from the applicant's current documents.
  attachDocumentIds: z.array(z.string()).max(20),
});
