import { NOTIFY_MESSAGE_LIMITS, notifyMessageDefault } from "@vera/shared";
import { Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useNotify } from "./api";
import { EMPTY_FINAL_INTERVIEW, readFinalInterview } from "./finalInterview";
import { FinalInterviewFields } from "./FinalInterviewFields";

/**
 * Notify for endorsement (FR-END-03, S15): the selected passed applicants get the notification with a fixed title and
 * HR's editable body. Decision 32: the client's final interview (date, time, details; required) goes into the same
 * message. Decision 37B: an information notice only; the applicants move to For endorsement at once and answer
 * nothing. The API refuses a body or details that name the company (422) and adds the final interview line itself,
 * so it is not part of the editable text.
 */
export function NotifyDialog({ vacancy, applicants, onClose, onDone }) {
  const notify = useNotify(vacancy.vacancyId);
  const [message, setMessage] = useState(() => notifyMessageDefault(vacancy.jobTitle));
  const [error, setError] = useState("");
  const [finalInterview, setFinalInterview] = useState(EMPTY_FINAL_INTERVIEW);
  const [finalErrors, setFinalErrors] = useState({});
  const count = applicants.length;

  function send() {
    const body = message.trim();
    const schedule = readFinalInterview(finalInterview);
    const tooShort = body.length < NOTIFY_MESSAGE_LIMITS.min;
    setError(tooShort ? `Write at least ${NOTIFY_MESSAGE_LIMITS.min} characters.` : "");
    setFinalErrors(schedule.errors ?? {});
    if (tooShort || schedule.errors) return;
    notify.mutate(
      { applicationIds: applicants.map((a) => a.applicationId), message: body, ...schedule.value },
      {
        onSuccess: (result) => {
          toast.success(
            `Notified ${result.notified.length} applicant${result.notified.length === 1 ? "" : "s"}. They are now For endorsement.`,
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
      description={`${applicants.map((a) => a.applicantName).join(", ")} will be told that they are selected for endorsement for ${vacancy.jobTitle}, with the final interview below, and move to For endorsement. They do not need to answer and never see the company name.`}
      confirmLabel="Notify applicants"
      pending={notify.isPending}
      error={notify.error?.message}
      onConfirm={send}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg bg-primary-soft px-4 py-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bell className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-label-sm font-semibold text-muted-foreground">Notification title</span>
            <span className="text-body font-semibold break-words text-heading">Selected for endorsement: {vacancy.jobTitle}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notify-message">Message</Label>
          <Textarea
            id="notify-message"
            rows={5}
            value={message}
            maxLength={NOTIFY_MESSAGE_LIMITS.max}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "notify-message-error" : undefined}
            onChange={(event) => {
              setMessage(event.target.value);
              setError("");
            }}
          />
          <FieldError id="notify-message-error" message={error} />
        </div>
        <FinalInterviewFields
          idPrefix="notify-final"
          value={finalInterview}
          errors={finalErrors}
          onChange={(next) => {
            setFinalInterview(next);
            setFinalErrors({});
          }}
        />
      </div>
    </ConfirmDialog>
  );
}
