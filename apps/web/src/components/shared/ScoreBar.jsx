import { cn } from "@/lib/utils";

/**
 * Progress bar for a score that is already shown next to it (UI_REDESIGN §3.2): track `progress-track`, fill blue → cyan.
 * Decorative (the ScoreChip carries the value), so hidden from screen readers; nothing for a null score.
 */
export function ScoreBar({ value, className }) {
  if (value === null || value === undefined) return null;
  const width = Math.min(100, Math.max(0, Number(value)));
  return (
    <span aria-hidden="true" className={cn("block h-1.5 w-24 overflow-hidden rounded-full bg-progress-track", className)}>
      <span className="block h-full rounded-full bg-linear-to-r from-primary to-cyan" style={{ width: `${width}%` }} />
    </span>
  );
}
