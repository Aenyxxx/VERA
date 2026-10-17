import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";

import { useAnswerOffer } from "./api";

/** Wording per kind: an S17 rematch offer (endorsement) or a Phase 3 job invitation (a normal application). */
const TEXT = {
  rematch_offer: {
    title: "Another job for you",
    description: (job) =>
      `The agency found another job that fits your profile: ${job}. Do you want the agency to endorse you for it? The employer makes the final hiring decision.`,
    accept: "Accept job offer",
    accepted: (job) => `Thank you. The agency will endorse you for ${job}.`,
    declineTitle: (job) => `Decline the job offer for ${job}?`,
    declineDescription:
      "The agency will not endorse you for this job. This does not count against you: you stay in our applicant pool and can apply to other jobs.",
    declineLabel: "Decline job offer",
    declined: "Job offer declined. You can apply to other jobs.",
  },
  job_invitation: {
    title: "Job invitation",
    description: (job) =>
      `The agency found a job that fits your profile: ${job}. Do you want to apply? Your application then goes through the agency's usual review.`,
    accept: "Apply",
    accepted: (job) => `Your application for ${job} was received.`,
    declineTitle: (job) => `Decline the invitation to ${job}?`,
    declineDescription:
      "You will not apply to this job. This does not count against you: you stay in our applicant pool and can apply to other jobs.",
    declineLabel: "Decline invitation",
    declined: "Invitation declined. You can apply to other jobs.",
  },
};

/**
 * Applicant pop-up for an automatic rematch offer (S17, PRD BR-23) or a job invitation from the applicant pool (Phase
 * 3, decision 17). Job title, location, employment type, and deadline only: never the company or a score. Decline
 * asks once more and states the neutral outcome. A 409 (the job is no longer available) is shown in the pop-up.
 */
export function JobOfferDialog({ offer, open, onOpenChange }) {
  const answer = useAnswerOffer();
  const [declining, setDeclining] = useState(false);
  const text = TEXT[offer.kind] ?? TEXT.rematch_offer;

  function send(decision) {
    answer.mutate(
      { offerId: offer.offerId, answer: decision },
      {
        onSuccess: () => {
          toast.success(decision === "accept" ? text.accepted(offer.jobTitle) : text.declined);
          setDeclining(false);
          onOpenChange(false);
        },
      },
    );
  }

  if (declining) {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !next && setDeclining(false)}
        title={text.declineTitle(offer.jobTitle)}
        description={text.declineDescription}
        confirmLabel={text.declineLabel}
        destructive
        pending={answer.isPending}
        error={answer.error?.message}
        onConfirm={() => send("decline")}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !answer.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description(offer.jobTitle)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-3 rounded-md bg-surface-subtle p-4 sm:grid-cols-2">
          <div>
            <dt className="text-label-sm text-muted-foreground">Job</dt>
            <dd className="text-body text-heading">{offer.jobTitle}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-muted-foreground">Location</dt>
            <dd className="text-body text-heading">{offer.deploymentLocation}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-muted-foreground">Employment type</dt>
            <dd className="text-body text-heading">{offer.employmentType}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-muted-foreground">Please answer by</dt>
            <dd className="text-body text-heading">{formatDateTime(offer.dueAt)} (Philippine time)</dd>
          </div>
        </dl>
        {answer.error && (
          <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
            {answer.error.message}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={answer.isPending} onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={answer.isPending}
            onClick={() => {
              answer.reset();
              setDeclining(true);
            }}
          >
            Decline
          </Button>
          <Button type="button" disabled={answer.isPending} onClick={() => send("accept")}>
            {answer.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            {text.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
