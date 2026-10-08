import { z } from "zod";

export const idParams = z.object({ id: z.uuid("Interview not found") });
export const listQuery = z.object({ vacancyId: z.uuid("Vacancy not found").optional() });

// The web app sends an ISO time with an explicit offset (+08:00, Philippine time), never a bare local time.
const scheduledAt = z.iso
  .datetime({ offset: true, error: "Pick the interview date and time." })
  .refine((value) => new Date(value).getTime() > Date.now(), "The interview time must be in the future.")
  .transform((value) => new Date(value).toISOString());

// Interviews are online only (FR-INT-02): an https meeting link is required.
const interviewFields = {
  scheduledAt,
  durationMinutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(240, "At most 4 hours.").default(30),
  meetingLink: z.url({ protocol: /^https$/, error: "Enter the meeting link (https://…)." }).max(500),
  interviewerId: z.uuid("Choose the interviewer."),
};

export const scheduleSchema = z.object({ applicationId: z.uuid("Open an application first."), ...interviewFields });
export const editSchema = z.object(interviewFields);
