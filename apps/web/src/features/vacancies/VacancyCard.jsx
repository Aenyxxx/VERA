import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { initialsOf } from "@/lib/auth";

/** HR vacancy card (DESIGN.md: company identity, job title, needed/remaining slots; FR-VAC-05 stage counts). */
export function VacancyCard({ vacancy }) {
  const { counts } = vacancy;
  return (
    <Link
      to={`/admin/vacancies/${vacancy.vacancyId}`}
      className="flex flex-col gap-4 rounded-md border bg-card p-5 outline-none transition-colors hover:border-primary hover:bg-surface-blue focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nav text-label-sm font-semibold text-white" aria-hidden="true">
          {initialsOf(vacancy.companyName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm text-muted-foreground">{vacancy.companyName}</p>
          <h2 className="truncate text-card-title font-semibold">{vacancy.jobTitle}</h2>
        </div>
        <StatusBadge kind="vacancy" value={vacancy.status} />
      </div>

      <p className="text-body text-heading">
        <span className="font-semibold tabular">{vacancy.remainingSlots}</span> of{" "}
        <span className="tabular">{vacancy.slotsNeeded}</span> slots remaining
      </p>

      <dl className="grid grid-cols-4 gap-2 border-t pt-3 text-center">
        {[
          ["Applicants", counts.total],
          ["Screening", counts.screening],
          ["Interview", counts.interview],
          ["Hired", counts.hired],
        ].map(([label, value]) => (
          <div key={label}>
            <dd className="text-card-title font-semibold text-heading tabular">{value}</dd>
            <dt className="text-label-sm text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
    </Link>
  );
}
