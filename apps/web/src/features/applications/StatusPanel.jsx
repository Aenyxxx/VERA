import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, APPLICATION_STATUS_LABELS, SHORTLISTED_IDLE_NEXT } from "@vera/shared";
import { AlertCircle, BriefcaseBusiness, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

import { useMyApplications } from "./api";

/**
 * Next action + deadline for one row (APP_FLOW §6). Shortlisted: "Upload requested documents" only while a document
 * request is pending (nextDueAt = its deadline); otherwise the applicant just waits for the agency.
 */
function nextActionOf(a) {
  if (a.status === APPLICATION_STATUS.SHORTLISTED) {
    return a.nextDueAt
      ? { next: APPLICATION_STATUS_LABELS[a.status].next, dueAt: a.nextDueAt }
      : { next: SHORTLISTED_IDLE_NEXT, dueAt: null };
  }
  return { next: APPLICATION_STATUS_LABELS[a.status]?.next, dueAt: a.actionDueAt };
}

/**
 * Dashboard status panel (PRD FR-PROF-08, APP_FLOW §3.5): one row per application with the job title,
 * applicant type, applied date, applicant stage label (APP_FLOW §6), and the next action + deadline if any.
 * Never shows the client company or any score.
 */
export function StatusPanel() {
  const applications = useMyApplications();

  if (applications.isPending) {
    return (
      <section className="flex flex-col gap-3 rounded-md border bg-card p-6" aria-busy="true" aria-label="My applications">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  if (applications.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Your applications could not be loaded"
        description={applications.error.message}
        action={<Button onClick={() => applications.refetch()}>Try again</Button>}
      />
    );
  }

  if (applications.data.length === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title="No applications yet"
        description="Find a job that fits you and apply with your resume."
        action={
          <Link to="/applicant/jobs" className={buttonVariants()}>
            Browse job vacancies
          </Link>
        }
      />
    );
  }

  return (
    <section aria-labelledby="status-panel-title" className="rounded-md border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <ListChecks className="size-5" aria-hidden="true" />
        </span>
        <h2 id="status-panel-title" className="text-card-title font-semibold">
          My applications
        </h2>
      </div>
      <ul className="divide-y">
        {applications.data.map((a) => {
          const { next, dueAt } = nextActionOf(a);
          return (
            <li key={a.applicationId} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-body font-semibold text-heading">{a.jobTitle}</p>
                  <p className="text-body-sm text-muted-foreground">
                    {APPLICANT_TYPE_LABELS[a.applicantType]} · Applied {formatDateTime(a.appliedAt)}
                  </p>
                </div>
                <StatusBadge kind="application" value={a.status} audience="applicant" />
              </div>
              {next && (
                <p className="text-body-sm text-text">
                  <span className="font-semibold">Next:</span> {next}
                  {dueAt && ` — due ${formatDateTime(dueAt)} (Philippine time)`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
