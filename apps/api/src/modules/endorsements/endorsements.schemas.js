import { ENDORSEMENT_OUTCOME } from "@vera/shared";
import { z } from "zod";

export const vacancyParams = z.object({ vacancyId: z.uuid("Vacancy not found") });
export const endorsementParams = z.object({ endorsementId: z.uuid("Endorsement not found") });
export const itemParams = z.object({ id: z.uuid("Endorsement item not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

export const createSchema = z.object({ vacancyId: z.uuid("Choose a vacancy") });

// The client's decision for one endorsed applicant (FR-END-07). The interview date and remarks are HR-only.
export const outcomeSchema = z.object({
  outcome: z.enum([ENDORSEMENT_OUTCOME.HIRED, ENDORSEMENT_OUTCOME.NOT_HIRED], "Choose hired or not hired"),
  clientInterviewAt: z.iso
    .datetime({ offset: true, error: "Enter the client's interview date and time." })
    .transform((value) => new Date(value).toISOString())
    .nullish(),
  remarks: z
    .string()
    .trim()
    .max(500, "At most 500 characters")
    .nullish()
    .transform((value) => value || null),
});

export const noBody = z.object({}).optional().default({});
