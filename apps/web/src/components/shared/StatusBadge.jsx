import {
  APPLICATION_STATUS_LABELS,
  INTERVIEW_STATUS_LABELS,
  VACANCY_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@vera/shared";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { TONE_CLASSES } from "./tones";

const LABELS = {
  verification: VERIFICATION_STATUS_LABELS,
  vacancy: VACANCY_STATUS_LABELS,
  interview: INTERVIEW_STATUS_LABELS,
};

function resolve(kind, value, audience) {
  if (kind === "application") {
    const entry = APPLICATION_STATUS_LABELS[value];
    return entry ? { label: entry[audience], tone: entry.tone } : null;
  }
  return LABELS[kind]?.[value] ?? null;
}

/**
 * Status label + tone from @vera/shared; components never hard-code status text.
 * @param {{ kind: "application"|"verification"|"vacancy"|"interview", value: string, audience?: "hr"|"applicant" }} props
 */
export function StatusBadge({ kind, value, audience = "hr", className }) {
  const { label, tone } = resolve(kind, value, audience) ?? { label: value, tone: "neutral" };
  return <Badge className={cn(TONE_CLASSES[tone], className)}>{label}</Badge>;
}
