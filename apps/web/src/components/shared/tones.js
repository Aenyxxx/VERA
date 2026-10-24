// Badge tone classes (UI_GUIDELINES §4.1; colours in docs/UI_REDESIGN.md §2–§3). Tones come from @vera/shared
// labels. The class names stay fixed (tests assert them); the redesign changes only the token values in index.css.
export const TONE_CLASSES = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
  interview: "bg-interview-soft text-interview",
  neutral: "bg-surface-subtle text-muted-foreground",
};
