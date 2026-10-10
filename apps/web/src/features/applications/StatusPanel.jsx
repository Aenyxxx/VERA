import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, APPLICATION_STATUS_LABELS, SHORTLISTED_IDLE_NEXT } from "@vera/shared";
import { AlertCircle, BriefcaseBusiness, ListChecks, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyOffers } from "@/features/rematch/api";
import { JobOfferDialog } from "@/features/rematch/JobOfferDialog";
import { formatDateTime } from "@/lib/format";

import { useMyApplications } from "./api";
import { EndorsementConfirmDialog } from "./EndorsementConfirmDialog";

/**
 * Next action + deadline for one row (APP_FLOW §6). Shortlisted: "Upload requested documents" only while a document
 * request is pending (nextDueAt = its deadline); otherwise the applicant just waits for the agency.
 * Interview scheduled: nextDueAt = the deadline to confirm the interview (S13).
 */
function nextActionOf(a) {
  if (a.status === APPLICATION_STATUS.SHORTLISTED) {
    return a.nextDueAt
      ? { next: APPLICATION_STATUS_LABELS[a.status].next, dueAt: a.nextDueAt }
      : { next: SHORTLISTED_IDLE_NEXT, dueAt: null };
  }
  if (a.status === APPLICATION_STATUS.INTERVIEW_SCHEDULED) {
    return { next: APPLICATION_STATUS_LABELS[a.status].next, dueAt: a.nextDueAt };
  }
  return { next: APPLICATION_STATUS_LABELS[a.status]?.next, dueAt: a.actionDueAt };
}

/**
 * Dashboard status panel (PRD FR-PROF-08, APP_FLOW §3.5): one row per application with the job title,
 * applicant type, applied date, applicant stage label (APP_FLOW §6), and the next action + deadline if any.
 * Never shows the client company or any score. An endorsement awaiting the applicant's answer (S15) opens the
 * confirm pop-up by itself once; closing it ("Not now") keeps the row's Answer button. A pending rematch job offer
 * (S17) works the same way: its pop-up opens by itself once and a "Job offer" row reopens it. Offers that cannot be
 * loaded are simply not shown (the applications stay usable).
 */
export function StatusPanel() {
  const applications = useMyApplications();
  const offers = useMyOffers();
  const [dismissed, setDismissed] = useState(null); // applicationId the applicant closed the pop-up for
  const [chosen, setChosen] = useState(null); // opened from the row's button
  const [dismissedOffer, setDismissedOffer] = useState(null); // offerId the applicant closed the pop-up for
  const [chosenOffer, setChosenOffer] = useState(null);

  const awaiting = applications.data?.find((a) => a.status === APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION) ?? null;
  const popup = chosen ?? (awaiting && awaiting.applicationId !== dismissed ? awaiting : null);
  const pendingOffers = offers.isSuccess ? offers.data : [];
  const firstOffer = pendingOffers[0] ?? null;
  // One pop-up at a time: the endorsement answer first.
  const offerPopup = popup ? null : (chosenOffer ?? (firstOffer && firstOffer.offerId !== dismissedOffer ? firstOffer : null));

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
      {pendingOffers.length > 0 && (
        <ul aria-label="Job offers" className="mb-4 flex flex-col gap-2">
          {pendingOffers.map((o) => (
            <li key={o.offerId} className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-body font-semibold text-heading">Job offer: {o.jobTitle}</p>
                  <p className="text-body-sm text-text">Answer by {formatDateTime(o.dueAt)} (Philippine time)</p>
                </div>
              </div>
              <Button size="sm" className="self-start sm:self-center" onClick={() => setChosenOffer(o)}>
                View job offer
              </Button>
            </li>
          ))}
        </ul>
      )}
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
              {a.status === APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION && (
                <Button size="sm" className="self-start" onClick={() => setChosen(a)}>
                  Answer for {a.jobTitle}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {popup && (
        <EndorsementConfirmDialog
          key={popup.applicationId}
          application={popup}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDismissed(popup.applicationId);
              setChosen(null);
            }
          }}
        />
      )}
      {offerPopup && (
        <JobOfferDialog
          key={offerPopup.offerId}
          offer={offerPopup}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDismissedOffer(offerPopup.offerId);
              setChosenOffer(null);
              offers.refetch(); // an expired offer (409) disappears from the list
            }
          }}
        />
      )}
    </section>
  );
}
