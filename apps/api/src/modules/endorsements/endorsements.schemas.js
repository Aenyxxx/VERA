import { ENDORSEMENT_OUTCOME } from "@vera/shared";
import { z } from "zod";

import { finalInterviewFields } from "../ranking/ranking.schemas.js";

export const vacancyParams = z.object({ vacancyId: z.uuid("Vacancy not found") });
export const endorsementParams = z.object({ endorsementId: z.uuid("Endorsement not found") });
export const itemParams = z.object({ id: z.uuid("Endorsement item not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

// Decision 32: one final interview for the whole batch; acknowledgeChange = HR saw the "differs from the notice" warning.
export const createSchema = z.object({
  vacancyId: z.uuid("Choose a vacancy"),
  ...finalInterviewFields,
  acknowledgeChange: z.boolean().optional().default(false),
});

// The client's decision for one applicant with the client (FR-END-07). Remarks are HR-only. The client interview
// time is no longer sent here: it is the final interview (decision 14, finalInterviewSchema).
export const outcomeSchema = z.object({
  outcome: z.enum([ENDORSEMENT_OUTCOME.HIRED, ENDORSEMENT_OUTCOME.NOT_HIRED], "Choose hired or not hired"),
  remarks: z
    .string()
    .trim()
    .max(500, "At most 500 characters")
    .nullish()
    .transform((value) => value || null),
});

// Decision 14: the client's final interview, encoded by HR and sent to the applicant. Any time is accepted (no clock
// check); the details are refused if they name the company (the service checks it).
export const finalInterviewSchema = z.object({
  scheduledAt: z.iso
    .datetime({ offset: true, error: "Enter the final interview date and time." })
    .transform((value) => new Date(value).toISOString()),
  details: z
    .string()
    .trim()
    .max(500, "At most 500 characters")
    .nullish()
    .transform((value) => value || null),
});

// Decision 37B: why HR removes an applicant from the endorsement (status_reason, HR only; never sent to the applicant).
export const removeSchema = z.object({
  reason: z.string("Enter the reason.").trim().min(5, "Write at least 5 characters").max(500, "At most 500 characters"),
});

export const noBody = z.object({}).optional().default({});
