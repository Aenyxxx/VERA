import { AlertCircle, ChevronRight, Handshake } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "@/features/companies/CompanyAvatar";
import { useEndorsementVacancies } from "@/features/endorsements/api";

const listCard = "overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-border/80";

/** One count as a soft blue pill (design 21's meta row, with VERA's own counts). */
function Count({ label, children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-primary-soft px-3 py-1.5 text-body-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-info tabular">{children}</dd>
    </div>
  );
}

/** Endorsement Management, step 1 (APP_FLOW §4.5, S16): vacancies that reached endorsement, with their counts. */
export default function Endorsements() {
  const vacancies = useEndorsementVacancies();

  return (
    <>
      <PageHeader title="Endorsement Management" />

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
          icon={Handshake}
          title="Nothing to endorse yet"
          description="A vacancy appears here once passed applicants are notified and endorsed from its Ranking tab."
        />
      ) : (
        <ul className={`${listCard} divide-y divide-border`}>
          {vacancies.data.map((v) => (
            <li key={v.vacancyId}>
              <Link
                to={`/admin/endorsements/${v.vacancyId}`}
                aria-label={`Endorsements for ${v.jobTitle} at ${v.companyName}`}
                className="group flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 outline-none transition-colors hover:bg-surface-blue focus-visible:bg-surface-blue focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-6"
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
                {/* decision 39-3: no "To endorse" count (Notify on the Ranking tab endorses at once) */}
                <dl className="flex flex-wrap gap-2">
                  <Count label="Endorsed">{v.endorsed}</Count>
                  <Count label="Deployed">
                    {v.hired} of {v.slotsNeeded}
                  </Count>
                </dl>
                <StatusBadge kind="vacancy" value={v.status} />
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
