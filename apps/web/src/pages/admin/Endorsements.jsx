import { AlertCircle, Handshake } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEndorsementVacancies } from "@/features/endorsements/api";

/** Endorsement Management, step 1 (APP_FLOW §4.5, S16): vacancies that reached endorsement, with their counts. */
export default function Endorsements() {
  const vacancies = useEndorsementVacancies();

  return (
    <>
      <PageHeader
        title="Endorsement Management"
        description="Create the endorsement from the applicants who confirmed, then record the client's decision for each one."
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
          icon={Handshake}
          title="Nothing to endorse yet"
          description="A vacancy appears here once a passed applicant confirms the endorsement."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vacancies.data.map((v) => (
            <li key={v.vacancyId}>
              <Link
                to={`/admin/endorsements/${v.vacancyId}`}
                aria-label={`Endorsements for ${v.jobTitle} at ${v.companyName}`}
                className="flex h-full flex-col gap-3 rounded-md border bg-card p-5 transition-colors hover:bg-surface-blue focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-card-title font-semibold text-heading">{v.jobTitle}</p>
                    <p className="truncate text-body-sm text-muted-foreground">{v.companyName}</p>
                  </div>
                  <StatusBadge kind="vacancy" value={v.status} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-body-sm">
                  <div>
                    <dt className="text-muted-foreground">To endorse</dt>
                    <dd className="font-semibold text-heading tabular">{v.forEndorsement}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Endorsed</dt>
                    <dd className="font-semibold text-heading tabular">{v.endorsed}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Hired</dt>
                    <dd className="font-semibold text-heading tabular">
                      {v.hired} of {v.slotsNeeded}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
