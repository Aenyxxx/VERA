import { zodResolver } from "@hookform/resolvers/zod";
import { INTERVIEW_STATUS, ROLE_LABELS } from "@vera/shared";
import { AlertCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/useMe";
import { manilaParts, manilaToday } from "@/lib/manilaTime";
import { cn } from "@/lib/utils";

import { useEditInterview, useInterviewers, useScheduleInterview } from "./api";
import { DURATIONS, interviewSchema, toInterviewBody } from "./schemas";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

function Field({ id, label, error, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Schedule an online interview (FR-INT-02) from the review sheet, or edit its time from Interviews Assessment
 * (pass `interview`). Date and time are typed in Philippine time and sent with +08:00, whatever the browser's
 * time zone. The interviewer defaults to the signed-in HR user. The parent remounts it (key) each time it opens.
 */
export function ScheduleInterviewDialog({ open, onOpenChange, applicationId, interview = null, applicantName, jobTitle, onDone }) {
  const interviewers = useInterviewers();
  const me = useMe();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]">
        {interviewers.data && !me.isLoading ? (
          <InterviewForm
            applicationId={applicationId}
            interview={interview}
            applicantName={applicantName}
            jobTitle={jobTitle}
            interviewers={interviewers.data}
            myId={me.data?.userId}
            onCancel={() => onOpenChange(false)}
            onDone={onDone}
          />
        ) : interviewers.isError ? (
          <>
            <DialogTitle className="sr-only">Schedule interview</DialogTitle>
            <EmptyState
              icon={AlertCircle}
              title="Interviewers could not be loaded"
              description={interviewers.error.message}
              action={<Button onClick={() => interviewers.refetch()}>Try again</Button>}
            />
          </>
        ) : (
          <div className="flex flex-col gap-3" aria-busy="true">
            <DialogTitle>{interview ? "Edit interview time" : "Schedule interview"}</DialogTitle>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function defaultsFor(interview, interviewers, myId) {
  if (interview) {
    return {
      ...manilaParts(interview.scheduledAt),
      durationMinutes: interview.durationMinutes,
      meetingLink: interview.meetingLink,
      interviewerId: interview.interviewerId ?? "",
    };
  }
  const mine = interviewers.some((i) => i.userId === myId) ? myId : "";
  return { date: "", time: "", durationMinutes: 30, meetingLink: "", interviewerId: mine };
}

function InterviewForm({ applicationId, interview, applicantName, jobTitle, interviewers, myId, onCancel, onDone }) {
  const schedule = useScheduleInterview();
  const edit = useEditInterview();
  const mutation = interview ? edit : schedule;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(interviewSchema), defaultValues: defaultsFor(interview, interviewers, myId) });

  const field = (name) => ({
    id: `interview-${name}`,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `interview-${name}-error` : undefined,
    ...register(name),
  });

  function submit(values) {
    const body = toInterviewBody(values);
    const variables = interview ? { interviewId: interview.interviewId, ...body } : { applicationId, ...body };
    mutation.mutate(variables, {
      onSuccess: (result) => {
        toast.success(interview ? "Interview time updated. The applicant was notified." : "Interview scheduled. The applicant was notified.");
        onDone?.(result);
      },
    });
  }

  const confirmed = interview?.status === INTERVIEW_STATUS.CONFIRMED;

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{interview ? "Edit interview time" : "Schedule interview"}</DialogTitle>
        <DialogDescription>
          {applicantName} · {jobTitle}. Online interview; all times are Philippine time.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="interview-date" label="Date" error={errors.date?.message}>
          <Input type="date" min={manilaToday()} {...field("date")} />
        </Field>
        <Field id="interview-time" label="Time (Philippine time)" error={errors.time?.message}>
          <Input type="time" step={60} {...field("time")} />
        </Field>
        <Field id="interview-durationMinutes" label="Duration" error={errors.durationMinutes?.message}>
          <select className={selectClass} {...field("durationMinutes")}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`}
              </option>
            ))}
          </select>
        </Field>
        <Field id="interview-interviewerId" label="Interviewer" error={errors.interviewerId?.message}>
          <select className={selectClass} {...field("interviewerId")}>
            <option value="">Select the interviewer</option>
            {interviewers.map((i) => (
              <option key={i.userId} value={i.userId}>
                {i.fullName} ({ROLE_LABELS[i.role]}){i.userId === myId ? " — you" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="interview-meetingLink" label="Meeting link" className="sm:col-span-2" error={errors.meetingLink?.message}>
          <Input type="url" inputMode="url" placeholder="https://meet.google.com/…" {...field("meetingLink")} />
        </Field>
      </div>

      <p className="rounded-sm bg-surface-subtle px-3 py-2 text-body-sm text-muted-foreground">
        {confirmed
          ? "The applicant already confirmed. The interview stays confirmed; they are notified of the new time and asked to contact the agency if they can't attend."
          : "The applicant confirms on their dashboard by the agency's response deadline (3 days by default) or the interview time, whichever comes first. The meeting link is shown to them after they confirm."}
      </p>

      {mutation.error && (
        <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
          {mutation.error.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {interview ? "Save new time" : "Schedule interview"}
        </Button>
      </DialogFooter>
    </form>
  );
}
