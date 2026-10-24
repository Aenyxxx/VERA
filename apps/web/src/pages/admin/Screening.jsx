import { APPLICANT_TYPE_LABELS } from "@vera/shared";
import { AlertCircle, ChevronRight, FileSearch, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "@/features/companies/CompanyAvatar";
import { useScreeningVacancies } from "@/features/screening/api";

const listCard = "overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-border/80";

/** One group's shortlist count as a soft blue pill (design 14's applicants pill, with VERA's per-group counts). */
function GroupCount({ label, shortlisted, quota }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-primary-soft px-3 py-1.5 text-body-sm">
      <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-info tabular">
        {shortlisted} of {quota}
      </dd>
    </div>
  );
}

/** Resume Screening, step 1 (UI_GUIDELINES §6): pick a vacancy. Counts per group come from the automatic shortlist. */
export default function Screening() {
  const vacancies = useScreeningVacancies();

  return (
    <>
      <PageHeader title="Resume Screening" />

      {vacancies.isPending ? (
        <div className={listCard} aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-4 last:border-b-0 sm:px-6">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <Skeleton className="h-10 w-full" />
            </div>
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
        <ul className={`${listCard} divide-y divide-border`}>
          {vacancies.data.map((v) => (
            <li key={v.vacancyId}>
              <Link
                to={`/admin/screening/${v.vacancyId}`}
                className="group flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 outline-none transition-colors hover:bg-surface-blue focus-visible:bg-surface-blue focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-6"
                aria-label={`Screen ${v.jobTitle} at ${v.companyName}`}
              >
                <div className="flex min-w-0 basis-full items-center gap-3 md:min-w-56 md:basis-0 md:flex-1">
                  <CompanyAvatar name={v.companyName} />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-card-title font-bold text-heading transition-colors group-hover:text-primary">
                      {v.jobTitle}
                    </p>
                    <p className="truncate text-body-sm text-muted-foreground">{v.companyName}</p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-2">
                  <GroupCount label={APPLICANT_TYPE_LABELS.experienced} shortlisted={v.experiencedShortlisted} quota={v.quota} />
                  <GroupCount label={APPLICANT_TYPE_LABELS.first_time} shortlisted={v.firstTimeShortlisted} quota={v.quota} />
                </dl>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge kind="vacancy" value={v.status} />
                  <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                    <Users className="size-4" aria-hidden="true" />
                    {v.waiting} waiting · {v.notShortlisted} not shortlisted
                  </p>
                </div>
                <ChevronRight
                  className="ml-auto size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
