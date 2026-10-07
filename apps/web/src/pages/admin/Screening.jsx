import { APPLICANT_TYPE_LABELS } from "@vera/shared";
import { AlertCircle, FileSearch, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreeningVacancies } from "@/features/screening/api";

/** Resume Screening, step 1 (UI_GUIDELINES §6): pick a vacancy. Counts per group come from the automatic shortlist. */
export default function Screening() {
  const vacancies = useScreeningVacancies();

  return (
    <>
      <PageHeader
        title="Resume Screening"
        description="Shortlists update automatically: the top 2 × slots per group by matching score."
      />

      {vacancies.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : vacancies.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Vacancies could not be loaded"
          description={vacancies.error.message}
          action={<Button onClick={() => vacancies.refetch()}>Try again</Button>}
        />
      ) : vacancies.data.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nothing to screen yet"
          description="Published vacancies appear here once applicants apply."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vacancies.data.map((v) => (
            <li key={v.vacancyId}>
              <Link
                to={`/admin/screening/${v.vacancyId}`}
                className="flex h-full flex-col gap-3 rounded-md border bg-card p-5 transition-colors hover:bg-surface-blue focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Screen ${v.jobTitle} at ${v.companyName}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-card-title font-semibold text-heading">{v.jobTitle}</p>
                    <p className="truncate text-body-sm text-muted-foreground">{v.companyName}</p>
                  </div>
                  <StatusBadge kind="vacancy" value={v.status} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-body-sm">
                  <div>
                    <dt className="text-muted-foreground">{APPLICANT_TYPE_LABELS.experienced}</dt>
                    <dd className="font-semibold text-heading tabular">
                      {v.experiencedShortlisted} of {v.quota}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{APPLICANT_TYPE_LABELS.first_time}</dt>
                    <dd className="font-semibold text-heading tabular">
                      {v.firstTimeShortlisted} of {v.quota}
                    </dd>
                  </div>
                </dl>
                <p className="mt-auto flex items-center gap-1.5 text-body-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  {v.waiting} waiting · {v.notShortlisted} not shortlisted
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
