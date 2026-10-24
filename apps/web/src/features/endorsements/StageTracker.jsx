import { APPLICATION_STATUS, CLIENT_STAGES } from "@vera/shared";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const A = APPLICATION_STATUS;

/** Decision 37C: the fixed client-outcome order (HR words; Deployed = hired). */
const STAGE_LABELS = {
  [A.FINAL_INTERVIEW_SCHEDULED]: "Final interview",
  [A.FOR_TRAINING]: "For training",
  [A.FOR_REQUIREMENTS]: "For requirements",
  [A.FOR_ORIENTATION]: "For orientation",
  [A.HIRED]: "Deployed",
};

/** Where a status sits in the order: endorsed is before the first stage; an old for_hiring row waits to be deployed. */
function currentIndex(status) {
  if (status === A.FOR_HIRING) return CLIENT_STAGES.indexOf(A.FOR_ORIENTATION);
  return CLIENT_STAGES.indexOf(status); // -1 for endorsed: no stage reached yet
}

/**
 * One applicant's stages with the client as a timeline (designs 28/29's style): done ones ticked, the current one
 * highlighted. The connector and disc are decorative and hold no text; the steps wrap on narrow screens.
 */
export function StageTracker({ status }) {
  const current = currentIndex(status);
  return (
    <ol aria-label="Client stages" className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-label-sm">
      {CLIENT_STAGES.map((stage, i) => {
        const done = i < current || (i === current && stage === A.HIRED);
        const isCurrent = i === current && !done;
        const deployed = done && stage === A.HIRED;
        return (
          <li key={stage} aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden="true" className={cn("h-0.5 w-4 rounded-full", i <= current ? "bg-primary" : "bg-border")} />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                done && !deployed && "bg-primary text-primary-foreground",
                deployed && "bg-success text-white",
                isCurrent && "bg-primary-soft ring-2 ring-primary",
                !done && !isCurrent && "bg-card ring-1 ring-control-border",
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
              {isCurrent && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span
              className={cn(
                done && (deployed ? "font-semibold text-success" : "text-heading"),
                isCurrent && "font-semibold text-primary",
                !done && !isCurrent && "text-muted-foreground",
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
            {done && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}
