import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";

import { useAnswerEndorsement } from "./api";

/**
 * Applicant pop-up for an endorsement awaiting their answer (FR-END-04, S15). Job title and deadline only: never the
 * company or a score. Decline asks once more and states the neutral outcome (BR-15: archived, no block, free to
 * apply elsewhere). The deadline is shown; the API answers 409 if the application moved meanwhile.
 */
export function EndorsementConfirmDialog({ application, open, onOpenChange }) {
  const answer = useAnswerEndorsement();
  const [declining, setDeclining] = useState(false);

  function send(decision) {
    answer.mutate(
      { applicationId: application.applicationId, answer: decision },
      {
        onSuccess: () => {
          toast.success(
            decision === "confirm"
              ? "Thank you. The agency will endorse you to the employer."
              : "Endorsement declined. You can apply to other jobs.",
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
        title={`Decline the endorsement for ${application.jobTitle}?`}
        description={`Your application for ${application.jobTitle} will be closed and you will not be endorsed to the employer. This does not count against you: you can apply to other jobs right away.`}
        confirmLabel="Decline endorsement"
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
          <DialogTitle>Confirm your endorsement</DialogTitle>
          <DialogDescription>
            You passed the agency assessment for {application.jobTitle}. Do you want the agency to endorse you to the employer? The
            employer makes the final hiring decision.
          </DialogDescription>
        </DialogHeader>
        <dl className="rounded-md bg-surface-subtle p-4">
          <dt className="text-label-sm text-muted-foreground">Please answer by</dt>
          <dd className="text-body text-heading">{formatDateTime(application.actionDueAt)} (Philippine time)</dd>
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
          <Button type="button" disabled={answer.isPending} onClick={() => send("confirm")}>
            {answer.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            Confirm endorsement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
