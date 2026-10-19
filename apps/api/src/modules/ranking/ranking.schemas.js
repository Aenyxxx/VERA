import { NOTIFY_MESSAGE_LIMITS } from "@vera/shared";
import { z } from "zod";

export const vacancyParams = z.object({ id: z.uuid("Vacancy not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

// Decision 32: the client's final interview, sent in the Notify message and set again at Create endorsement. Required
// at both; any time is accepted (no clock check). The company-name check runs in the services.
export const finalInterviewFields = {
  finalInterviewAt: z.iso
    .datetime({ offset: true, error: "Enter the final interview date and time." })
    .transform((value) => new Date(value).toISOString()),
  finalInterviewDetails: z
    .string("Enter the final interview details.")
    .trim()
    .min(1, "Enter the final interview details.")
    .max(500, "At most 500 characters"),
};

// Notify (FR-END-03): the selected passed applications and HR's message body. The deadline line is added by the
// API, so it never appears here. The company-name check runs in the service (it needs the vacancy).
export const notifySchema = z.object({
  applicationIds: z
    .array(z.uuid("Unknown application"))
    .min(1, "Select at least one passed applicant")
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Each applicant can be selected once"),
  message: z
    .string()
    .trim()
    .min(NOTIFY_MESSAGE_LIMITS.min, `Write at least ${NOTIFY_MESSAGE_LIMITS.min} characters`)
    .max(NOTIFY_MESSAGE_LIMITS.max, `At most ${NOTIFY_MESSAGE_LIMITS.max} characters`)
    .optional(),
  ...finalInterviewFields,
});

export const noBody = z.object({}).optional().default({});
