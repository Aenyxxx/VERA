import { NOTIFY_MESSAGE_LIMITS } from "@vera/shared";
import { z } from "zod";

export const vacancyParams = z.object({ id: z.uuid("Vacancy not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

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
});

export const noBody = z.object({}).optional().default({});
