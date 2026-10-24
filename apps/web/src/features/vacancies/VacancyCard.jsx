import { ChevronRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { CompanyAvatar } from "@/features/companies/CompanyAvatar";

/** HR vacancy card (DESIGN.md: company identity, job title, needed/remaining slots; FR-VAC-05 stage counts; design 06). */
export function VacancyCard({ vacancy }) {
  const { counts } = vacancy;
  return (
    <Link
      to={`/admin/vacancies/${vacancy.vacancyId}`}
      className="group/card flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 outline-none transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <CompanyAvatar name={vacancy.companyName} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-heading">{vacancy.companyName}</p>
          <h2 className="truncate font-heading text-card-title font-bold text-primary">{vacancy.jobTitle}</h2>
        </div>
        <StatusBadge kind="vacancy" value={vacancy.status} />
        <ChevronRight
          className="mt-0.5 size-5 shrink-0 text-primary transition-transform duration-150 group-hover/card:translate-x-0.5"
          aria-hidden="true"
        />
      </div>

      <p className="flex items-center gap-3 text-body text-heading">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <Users className="size-5" />
        </span>
        <span>
          <span className="font-heading text-card-title font-bold tabular">{vacancy.remainingSlots}</span> of{" "}
          <span className="tabular">{vacancy.slotsNeeded}</span> slots remaining
        </span>
      </p>

      <dl className="grid grid-cols-4 gap-1.5 text-center sm:gap-2">
        {[
          ["Applicants", counts.total],
          ["Screening", counts.screening],
          ["Interview", counts.interview],
          ["Hired", counts.hired],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-blue px-1 py-2">
            <dd className="font-heading text-card-title font-bold text-heading tabular">{value}</dd>
            <dt className="truncate text-label-sm text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
    </Link>
  );
}
