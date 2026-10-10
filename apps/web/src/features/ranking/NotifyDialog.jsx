import { NOTIFY_MESSAGE_LIMITS, notifyMessageDefault } from "@vera/shared";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

import { useNotify } from "./api";

/**
 * Notify for endorsement (FR-END-03, S15): the selected passed applicants get the notification with a fixed title and
 * HR's editable body. The API refuses a body that names the company (422) and appends the confirm-by line itself,
 * so the deadline is never part of the editable text.
 */
export function NotifyDialog({ vacancy, applicants, onClose, onDone }) {
  const notify = useNotify(vacancy.vacancyId);
  const [message, setMessage] = useState(() => notifyMessageDefault(vacancy.jobTitle));
  const [error, setError] = useState("");
  const count = applicants.length;

  function send() {
    const body = message.trim();
    if (body.length < NOTIFY_MESSAGE_LIMITS.min) {
      setError(`Write at least ${NOTIFY_MESSAGE_LIMITS.min} characters.`);
      return;
    }
    notify.mutate(
      { applicationIds: applicants.map((a) => a.applicationId), message: body },
      {
        onSuccess: (result) => {
          toast.success(
            `Notified ${result.notified.length} applicant${result.notified.length === 1 ? "" : "s"}. They can confirm until ${formatDateTime(result.actionDueAt)} (Philippine time).`,
          );
          onDone();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Notify ${count} applicant${count === 1 ? "" : "s"} for endorsement?`}
      description={`${applicants.map((a) => a.applicantName).join(", ")} will be asked to confirm that they want to be endorsed for ${vacancy.jobTitle}. They never see the company name.`}
      confirmLabel="Notify applicants"
      pending={notify.isPending}
      error={notify.error?.message}
      onConfirm={send}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5 rounded-sm bg-surface-subtle px-3 py-2">
          <span className="text-label-sm text-muted-foreground">Notification title (fixed)</span>
          <span className="text-body text-heading">Please confirm: {vacancy.jobTitle}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notify-message">Message</Label>
          <Textarea
            id="notify-message"
            rows={5}
            value={message}
            maxLength={NOTIFY_MESSAGE_LIMITS.max}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "notify-message-error notify-message-hint" : "notify-message-hint"}
            onChange={(event) => {
              setMessage(event.target.value);
              setError("");
            }}
          />
          <FieldError id="notify-message-error" message={error} />
          <p id="notify-message-hint" className="text-body-sm text-muted-foreground">
            Don&apos;t name the company. The line &quot;Please confirm on your dashboard by …&quot; with the deadline is added
            automatically.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
