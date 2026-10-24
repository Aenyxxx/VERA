import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const tileClass = "relative overflow-hidden rounded-xl p-4 shadow-card ring-1 sm:p-6";
const accentClass =
  "flex flex-col gap-2 bg-card ring-border/80 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-primary before:to-cyan";

// Tinted tiles (Dashboard): soft fill, icon disc, label and chevron in the tone colour. The text/fill pairs are the
// badge tones of docs/UI_REDESIGN.md §2.2 (≥ 4.5:1). Full class strings so Tailwind can find them.
const TONES = {
  info: { tile: "bg-info-soft ring-info/15", disc: "bg-info/12", text: "text-info" },
  warning: { tile: "bg-warning-soft ring-warning/15", disc: "bg-warning/12", text: "text-warning" },
  resume: { tile: "bg-resume-soft ring-resume/15", disc: "bg-resume/12", text: "text-resume" },
  interview: { tile: "bg-interview-soft ring-interview/15", disc: "bg-interview/12", text: "text-interview" },
  success: { tile: "bg-success-soft ring-success/15", disc: "bg-success/12", text: "text-success" },
  neutral: { tile: "bg-surface-subtle ring-border", disc: "bg-muted-foreground/12", text: "text-muted-foreground" },
};

/**
 * Dashboard total (docs/UI_REDESIGN.md §3): label and a large tabular number. Without `icon`: a white card with a
 * blue→cyan top accent (Reports). With `icon` (lucide): the icon in a round disc on the left, the number above the
 * label, and a soft `tone` fill (keys of TONES, default info). With `to`, the whole tile links to the filtered list
 * behind the number and shows a chevron. The label and the number stay direct siblings, label first in the DOM
 * (tests read the number as the label's next element; screen readers hear "label value").
 */
export function MetricTile({ label, value, to, icon: Icon, tone = "info" }) {
  const toneClasses = TONES[tone] ?? TONES.info;
  const number = <span className="font-heading text-metric font-extrabold text-heading tabular">{value}</span>;

  const content = Icon ? (
    <>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", toneClasses.disc, toneClasses.text)}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col-reverse gap-0.5">
        <span className={cn("text-body font-semibold", toneClasses.text)}>{label}</span>
        {number}
      </span>
      {to && (
        <ChevronRight
          className={cn("size-5 shrink-0 transition-transform duration-150 group-hover/tile:translate-x-0.5", toneClasses.text)}
          aria-hidden="true"
        />
      )}
    </>
  ) : (
    <>
      <span className="text-label-sm font-semibold text-muted-foreground">{label}</span>
      {number}
      {to && (
        <ChevronRight
          className="absolute top-4 right-4 size-5 text-primary transition-transform duration-150 group-hover/tile:translate-x-0.5 sm:top-6 sm:right-6"
          aria-hidden="true"
        />
      )}
    </>
  );

  const className = cn(tileClass, Icon ? cn("flex items-center gap-4", toneClasses.tile) : accentClass);
  if (!to) return <div className={className}>{content}</div>;
  return (
    <Link
      to={to}
      className={cn(
        className,
        "group/tile transition-[box-shadow,transform] duration-150 ease-out outline-none hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      {content}
    </Link>
  );
}
