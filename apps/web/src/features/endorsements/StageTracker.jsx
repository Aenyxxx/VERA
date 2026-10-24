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

/** One applicant's stages with the client: done ones ticked, the current one highlighted. */
export function StageTracker({ status }) {
  const current = currentIndex(status);
  return (
    <ol aria-label="Client stages" className="flex flex-wrap items-center gap-1 text-caption">
      {CLIENT_STAGES.map((stage, i) => {
        const done = i < current || (i === current && stage === A.HIRED);
        const isCurrent = i === current && !done;
        return (
          <li
            key={stage}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5",
              done && "bg-success-soft text-success",
              isCurrent && "bg-info-soft font-semibold text-info",
              !done && !isCurrent && "bg-surface-subtle text-muted-foreground",
            )}
          >
            {done && <Check className="size-3" aria-hidden="true" />}
            {STAGE_LABELS[stage]}
            {done && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}
