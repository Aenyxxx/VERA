const LABELS = { resume: "Resume", interview: "Interview", final: "Final" };

/**
 * Blue score bands (UI_REDESIGN §3.2, owner Oct 24): no red/green, so no implied pass/fail. The band follows the shown
 * (2-decimal) value, so 79.996 shows as 80.00% in the top band.
 */
function scoreBand(value) {
  const shown = Number(Number(value).toFixed(2));
  if (shown >= 80) return "bg-primary text-primary-foreground";
  if (shown >= 60) return "bg-info-soft text-info";
  return "bg-surface-subtle text-muted-foreground";
}

// Sizes live here, not in `className`. The classes are joined without tailwind-merge: it reads the custom text-* sizes
// (text-label-sm, text-body…) as colours and would drop either the size or the band's text colour.
const SIZES = {
  sm: "px-2 py-0.5 text-label-sm",
  md: "px-2.5 py-1 text-body", // screening rows (design 15)
  lg: "px-3 py-1.5 text-body-lg", // review sheet's matching panel
};

/**
 * A score with its label and % (UI_GUIDELINES §7: never a bare number; null → "Not evaluated", never 0).
 * @param {{ kind: "resume"|"interview"|"final", value: number|null, size?: "sm"|"md"|"lg" }} props
 */
export function ScoreChip({ kind, value, size = "sm", className }) {
  const hasValue = value !== null && value !== undefined;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md font-semibold tabular",
        SIZES[size],
        hasValue ? scoreBand(value) : "bg-surface-subtle text-muted-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{LABELS[kind]}</span>
      <span>{hasValue ? `${Number(value).toFixed(2)}%` : "Not evaluated"}</span>
    </span>
  );
}
