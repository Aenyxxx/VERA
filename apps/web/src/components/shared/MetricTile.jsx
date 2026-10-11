import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const tileClass = "flex flex-col gap-2 rounded-md border bg-card p-4 sm:p-6";

/**
 * Dashboard total (UI_GUIDELINES §4): label and a large tabular number. With `to`, the whole tile links to the
 * filtered list behind the number.
 */
export function MetricTile({ label, value, to }) {
  const content = (
    <>
      <span className="text-label-sm font-semibold text-muted-foreground">{label}</span>
      <span className="text-metric font-bold text-heading tabular">{value}</span>
    </>
  );
  if (!to) return <div className={tileClass}>{content}</div>;
  return (
    <Link
      to={to}
      className={cn(
        tileClass,
        "transition-colors outline-none hover:border-primary hover:bg-surface-blue focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {content}
    </Link>
  );
}
