import { cn } from "@/lib/utils";

const KINDS = {
  resume: { label: "Resume", className: "bg-resume-soft text-resume" },
  interview: { label: "Interview", className: "bg-interview-soft text-interview" },
  final: { label: "Final", className: "bg-info-soft text-info" },
};

/**
 * A score with its label and % (UI_GUIDELINES §7: never a bare number; null → "Not evaluated", never 0).
 * @param {{ kind: "resume"|"interview"|"final", value: number|null }} props
 */
export function ScoreChip({ kind, value, className }) {
  const { label, className: tone } = KINDS[kind];
  const hasValue = value !== null && value !== undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-label-sm font-semibold tabular",
        hasValue ? tone : "bg-surface-subtle text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      <span>{hasValue ? `${Number(value).toFixed(2)}%` : "Not evaluated"}</span>
    </span>
  );
}
