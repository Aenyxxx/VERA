import { manilaIso } from "@/lib/manilaTime";

export const EMPTY_FINAL_INTERVIEW = { date: "", time: "", details: "" };

/**
 * Decision 32: the client's final interview as the API takes it ({ finalInterviewAt, finalInterviewDetails }), or the
 * field errors when something is missing. Any time is accepted (no clock check).
 */
export function readFinalInterview({ date, time, details }) {
  const finalInterviewAt = manilaIso(date, time);
  const errors = {};
  if (!finalInterviewAt) errors.when = "Enter the date and the time.";
  if (!details.trim()) errors.details = "Enter the final interview details.";
  return Object.keys(errors).length > 0 ? { errors } : { value: { finalInterviewAt, finalInterviewDetails: details.trim() } };
}
