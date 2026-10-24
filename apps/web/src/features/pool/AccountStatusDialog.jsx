import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useChangePoolAccount } from "@/features/rematch/api";

/**
 * Decision 37D: activate or deactivate an applicant's WHOLE account from the Applicant Pool (HR and admin), the same
 * mechanism as staff accounts. Deactivate needs a reason (HR only, never shown to the applicant); the applicant can no
 * longer sign in, a pending job offer or invitation ends, and pool matching skips them. Activate reverses it.
 */
export function AccountStatusDialog({ entry, onClose }) {
  const change = useChangePoolAccount();
  const deactivating = entry.accountStatus !== "inactive";
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
        ? { talentPoolId: entry.talentPoolId, accountStatus: "inactive", reason: trimmed }
        : { talentPoolId: entry.talentPoolId, accountStatus: "active" },
      {
        onSuccess: (result) => {
          if (!deactivating) toast.success(`${entry.applicantName}'s account is active again.`);
          else if (result.signInBlocked === false) toast.warning(`${entry.applicantName}'s account is inactive, but sign-in could not be blocked yet. Deactivate again to retry.`);
          else toast.success(`${entry.applicantName}'s account is inactive.`);
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={deactivating ? `Deactivate ${entry.applicantName}'s account?` : `Activate ${entry.applicantName}'s account?`}
      description={
        deactivating
          ? `${entry.applicantName} will no longer be able to sign in to VERA. A pending job offer or invitation ends, and pool matching skips them until the account is active again.`
          : `${entry.applicantName} can sign in again and is back in pool matching. Offers or invitations that ended are not restored.`
      }
      confirmLabel={deactivating ? "Deactivate account" : "Activate account"}
      destructive={deactivating}
      pending={change.isPending}
      error={change.error?.message}
      onConfirm={submit}
    >
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
