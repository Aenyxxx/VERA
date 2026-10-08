import { z } from "zod";

import { manilaIso } from "@/lib/manilaTime";

/** Duration choices in minutes (the API accepts 15–240). */
export const DURATIONS = [15, 30, 45, 60, 90, 120];

// Schedule / edit form (FR-INT-02). Date and time are Philippine time; the API gets them as one +08:00 timestamp.
// Mirrors apps/api/src/modules/interviews/interviews.schemas.js.
export const interviewSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the interview date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick the interview time."),
    durationMinutes: z.coerce.number().int().min(15).max(240),
    meetingLink: z
      .string()
      .trim()
      .pipe(z.url({ protocol: /^https$/, error: "Enter the meeting link (https://…)." }).max(500)),
    interviewerId: z.string().min(1, "Choose the interviewer."),
  })
  .refine((v) => {
    const iso = manilaIso(v.date, v.time);
    return !iso || new Date(iso).getTime() > Date.now();
  }, { path: ["time"], message: "The interview time must be in the future." });

/** Form values → API body (scheduledAt always carries +08:00). */
export function toInterviewBody(values) {
  return {
    scheduledAt: manilaIso(values.date, values.time),
    durationMinutes: values.durationMinutes,
    meetingLink: values.meetingLink,
    interviewerId: values.interviewerId,
  };
}
