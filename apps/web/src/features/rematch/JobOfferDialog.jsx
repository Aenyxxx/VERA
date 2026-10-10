import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";

import { useAnswerOffer } from "./api";

/**
 * Applicant pop-up for an automatic rematch offer (S17, PRD BR-23). Job title, location, employment type, and deadline
 * only: never the company or a score. Decline asks once more and states the neutral outcome. A 409 (the job is no
 * longer available) is shown in the pop-up.
 */
export function JobOfferDialog({ offer, open, onOpenChange }) {
  const answer = useAnswerOffer();
  const [declining, setDeclining] = useState(false);

  function send(decision) {
    answer.mutate(
      { offerId: offer.offerId, answer: decision },
      {
        onSuccess: () => {
          toast.success(
            decision === "accept"
              ? `Thank you. The agency will endorse you for ${offer.jobTitle}.`
              : "Job offer declined. You can apply to other jobs.",
          );
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
        title={`Decline the job offer for ${offer.jobTitle}?`}
        description="The agency will not endorse you for this job. This does not count against you: you stay in our applicant pool and can apply to other jobs."
        confirmLabel="Decline job offer"
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
          <DialogTitle>Another job for you</DialogTitle>
          <DialogDescription>
            The agency found another job that fits your profile: {offer.jobTitle}. Do you want the agency to endorse you for it? The
            employer makes the final hiring decision.
          </DialogDescription>
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
            Accept job offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
