import { APPLICATION_OUTCOME, APPLICATION_STATUS } from "@vera/shared";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useChangeApplicantAccount } from "./api";

/**
 * Decision 39-4 (moved from the Applicant Pool, decision 37D): activate or deactivate ANY applicant's WHOLE account
 * (HR and admin), the same mechanism as staff accounts. Deactivate needs a reason (HR only, never shown to the
 * applicant); the applicant can no longer sign in, an ongoing application is closed neutrally (warned below), a pending
 * job offer or invitation ends, and pool matching skips them. A Deployed application stays. Activate reverses the
 * account only. `row` is an Applicant Management row (applicantId, applicantName, accountStatus, status, jobTitle).
 */
export function AccountDialog({ row, onClose }) {
  const change = useChangeApplicantAccount();
  const deactivating = row.accountStatus !== "inactive";
  const ongoing = APPLICATION_OUTCOME.ONGOING.includes(row.status);
  const deployed = row.status === APPLICATION_STATUS.HIRED;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);

  function submit() {
    const trimmed = reason.trim();
    if (deactivating && trimmed.length < 5) {
      setReasonError("Write the reason (at least 5 characters).");
      return;
    }
    change.mutate(
      deactivating
        ? { applicantId: row.applicantId, accountStatus: "inactive", reason: trimmed }
        : { applicantId: row.applicantId, accountStatus: "active" },
      {
        onSuccess: (result) => {
          const name = row.applicantName;
          if (!deactivating) toast.success(`${name}'s account is active again.`);
          else if (result.signInBlocked === false) toast.warning(`${name}'s account is inactive, but sign-in could not be blocked yet. Deactivate again to retry.`);
          else if (result.closedApplication) toast.success(`${name}'s account is inactive and their application was closed.`);
          else toast.success(`${name}'s account is inactive.`);
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={deactivating ? `Deactivate ${row.applicantName}'s account?` : `Activate ${row.applicantName}'s account?`}
      description={
        deactivating
          ? `${row.applicantName} will no longer be able to sign in to VERA. A pending job offer or invitation ends, and pool matching skips them until the account is active again.`
          : `${row.applicantName} can sign in again and is back in pool matching. A closed application, and offers or invitations that ended, are not restored.`
      }
      confirmLabel={deactivating ? "Deactivate account" : "Activate account"}
      destructive={deactivating}
      pending={change.isPending}
      error={change.error?.message}
      onConfirm={submit}
    >
      {deactivating && ongoing && (
        <p role="note" className="flex gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-body text-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Their application for {row.jobTitle} will be closed (Application closed: no applicant pool entry, no company block).
            Its interviews and document requests are cancelled; if they are with the client, the endorsement is marked.
          </span>
        </p>
      )}
      {deactivating && deployed && (
        <p className="text-body-sm text-muted-foreground">Their Deployed application for {row.jobTitle} stays as it is.</p>
      )}
      {deactivating && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="deactivate-reason">Reason</Label>
          <Textarea
            id="deactivate-reason"
            value={reason}
            maxLength={500}
            aria-invalid={Boolean(reasonError)}
            aria-describedby={reasonError ? "deactivate-reason-error" : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
            }}
          />
          <FieldError id="deactivate-reason-error" message={reasonError} />
        </div>
      )}
    </ConfirmDialog>
  );
}
