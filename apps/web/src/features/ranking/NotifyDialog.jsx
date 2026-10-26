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
 * Notify and endorse (FR-END-03/05, S15; decision 39-3): one click endorses the selected applicants to the client as
 * one batch with the client's final interview (date, time, details; required, decision 32). Each applicant gets ONE
 * notice with a fixed title, HR's editable body and the final interview line (added by the API, so not part of the
 * editable text), answers nothing (decision 37B) and moves to Final interview at once. The API refuses a body or
 * details that name the company (422).
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
          toast.success(`Notified and endorsed ${result.notified.length} applicant${result.notified.length === 1 ? "" : "s"}.`);
          onDone();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Notify and endorse ${count} applicant${count === 1 ? "" : "s"}?`}
      description={`${applicants.map((a) => a.applicantName).join(", ")} will be endorsed to ${vacancy.companyName} for ${vacancy.jobTitle} as one batch, with the final interview below, and move to Final interview. Each gets one notice with the final interview; they do not need to answer and never see the company name. The batch appears in Endorsement Management with its printable page.`}
      confirmLabel="Notify"
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
