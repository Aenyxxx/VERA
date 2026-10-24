import { zodResolver } from "@hookform/resolvers/zod";
import { ROLE_LABELS } from "@vera/shared";
import { AlertCircle, Link2, Loader2 } from "lucide-react";
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

import { useApproveReschedule, useEditInterview, useInterviewers, useScheduleInterview } from "./api";
import { DURATIONS, interviewSchema, toInterviewBody } from "./schemas";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-body outline-none transition-colors hover:border-heading/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

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
 * Schedule an online interview (FR-INT-02) from the review sheet, or edit its time from Interview Assessment
 * (pass `interview`), or approve the applicant's reschedule request with a new time (pass `interview` and
 * `approve`, Phase 4 decision 20: a new attempt, set at once, decision 37). Date and time are typed in Philippine
 * time and sent with +08:00, whatever the browser's time zone. The interviewer defaults to the signed-in HR user.
 * The parent remounts it (key) each time it opens.
 */
export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  interview = null,
  approve = false,
  applicantName,
  jobTitle,
  onDone,
}) {
  const interviewers = useInterviewers();
  const me = useMe();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]">
        {interviewers.data && !me.isLoading ? (
          <InterviewForm
            applicationId={applicationId}
            interview={interview}
            approve={approve}
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
            <DialogTitle>{titleFor(interview, approve)}</DialogTitle>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const titleFor = (interview, approve) => (approve ? "Set the new interview time" : interview ? "Edit interview time" : "Schedule interview");

function defaultsFor(interview, interviewers, myId, approve) {
  if (interview) {
    return {
      // Approve: the applicant could not make the current time, so the date and time start empty.
      ...(approve ? { date: "", time: "" } : manilaParts(interview.scheduledAt)),
      durationMinutes: interview.durationMinutes,
      meetingLink: interview.meetingLink,
      interviewerId: interview.interviewerId ?? "",
    };
  }
  const mine = interviewers.some((i) => i.userId === myId) ? myId : "";
  return { date: "", time: "", durationMinutes: 30, meetingLink: "", interviewerId: mine };
}

function InterviewForm({ applicationId, interview, approve, applicantName, jobTitle, interviewers, myId, onCancel, onDone }) {
  const schedule = useScheduleInterview();
  const edit = useEditInterview();
  const approveRequest = useApproveReschedule();
  const mutation = approve ? approveRequest : interview ? edit : schedule;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(interviewSchema), defaultValues: defaultsFor(interview, interviewers, myId, approve) });

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
        toast.success(
          approve
            ? "New time set. The applicant was notified."
            : interview
              ? "Interview time updated. The applicant was notified."
              : "Interview scheduled. The applicant was notified.",
        );
        onDone?.(result);
      },
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{titleFor(interview, approve)}</DialogTitle>
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
          <div className="relative">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <Input type="url" inputMode="url" placeholder="https://meet.google.com/…" className="pl-9" {...field("meetingLink")} />
          </div>
        </Field>
      </div>

      <p className="rounded-md bg-surface-subtle px-3 py-2 text-body-sm text-muted-foreground">
        {approve
          ? `The applicant asked to reschedule: "${interview.rescheduleReason ?? ""}". The current time is cancelled and the new time is set at once; the applicant is notified.`
          : interview
          ? "The new time is set at once; the applicant is notified and asked to contact the agency if they can't attend."
          : "The interview is set at once. The applicant is notified and sees the meeting link on their dashboard."}
      </p>

      {mutation.error && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-body text-error">
          {mutation.error.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {approve ? "Approve with this time" : interview ? "Save new time" : "Schedule interview"}
        </Button>
      </DialogFooter>
    </form>
  );
}
