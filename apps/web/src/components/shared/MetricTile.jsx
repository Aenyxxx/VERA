import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const tileClass =
  "relative flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-primary before:to-cyan sm:p-6";

/**
 * Dashboard total (docs/UI_REDESIGN.md §3): label and a large tabular number on a white card with a blue→cyan top
 * accent. With `to`, the whole tile links to the filtered list behind the number (chevron top right). `icon`
 * (optional) is a lucide icon in a soft blue disc above the label; no page passes it yet. The label and the number
 * stay direct siblings (tests read the number as the label's next element).
 */
export function MetricTile({ label, value, to, icon: Icon }) {
  const content = (
    <>
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="text-label-sm font-semibold text-muted-foreground">{label}</span>
      <span className="font-heading text-metric font-extrabold text-heading tabular">{value}</span>
      {to && (
        <ChevronRight
          className="absolute top-4 right-4 size-5 text-primary transition-transform duration-150 group-hover/tile:translate-x-0.5 sm:top-6 sm:right-6"
          aria-hidden="true"
        />
      )}
    </>
  );
  if (!to) return <div className={tileClass}>{content}</div>;
  return (
    <Link
      to={to}
      className={cn(
        tileClass,
        "group/tile transition-[box-shadow,transform] duration-150 ease-out outline-none hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      {content}
    </Link>
  );
}
