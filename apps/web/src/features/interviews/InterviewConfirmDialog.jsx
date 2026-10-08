import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import { manilaTimeRange } from "@/lib/manilaTime";

import { useConfirmInterview } from "./api";

/**
 * Applicant pop-up for an interview awaiting confirmation (FR-INT-02, APP_FLOW §3.3). Job title only, never the
 * company; the meeting link appears only after confirming. No reschedule requests during the sprint
 * (ROADMAP §6): an applicant who can't attend contacts the agency.
 */
export function InterviewConfirmDialog({ interview, open, onOpenChange }) {
  const confirm = useConfirmInterview();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm your interview"
      description={`The agency scheduled an online interview for your application for ${interview.jobTitle}.`}
      confirmLabel="Confirm attendance"
      pending={confirm.isPending}
      error={confirm.error?.message}
      onConfirm={() =>
        confirm.mutate(interview.interviewId, {
          onSuccess: () => {
            toast.success("Interview confirmed. The meeting link is on your dashboard.");
            onOpenChange(false);
          },
        })
      }
    >
      <dl className="grid grid-cols-1 gap-3 rounded-md bg-surface-subtle p-4 sm:grid-cols-2">
        <div>
          <dt className="text-label-sm text-muted-foreground">Date and time</dt>
          <dd className="text-body text-heading">{formatDateTime(interview.scheduledAt)} (Philippine time)</dd>
        </div>
        <div>
          <dt className="text-label-sm text-muted-foreground">Time and length</dt>
          <dd className="text-body text-heading">
            {manilaTimeRange(interview.scheduledAt, interview.durationMinutes)} · {interview.durationMinutes} minutes
          </dd>
        </div>
        <div>
          <dt className="text-label-sm text-muted-foreground">Where</dt>
          <dd className="text-body text-heading">Online (the link is shown after you confirm)</dd>
        </div>
        {interview.interviewerName && (
          <div>
            <dt className="text-label-sm text-muted-foreground">Interviewer</dt>
            <dd className="text-body text-heading">{interview.interviewerName}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-label-sm text-muted-foreground">Please confirm by</dt>
          <dd className="text-body text-heading">{formatDateTime(interview.confirmDueAt)} (Philippine time)</dd>
        </div>
      </dl>
      <p className="text-body-sm text-muted-foreground">Can't attend at this time? Please contact Confiable Manpower.</p>
    </ConfirmDialog>
  );
}
