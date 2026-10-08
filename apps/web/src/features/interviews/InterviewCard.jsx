import { INTERVIEW_STATUS } from "@vera/shared";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, ExternalLink, Info, UserRound, Video } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { manilaTimeRange } from "@/lib/manilaTime";

import { useMyInterviews } from "./api";
import { InterviewConfirmDialog } from "./InterviewConfirmDialog";

const dateBlock = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** { month: "OCT", day: "12", year: "2026" } in Philippine time. */
function dateParts(iso) {
  const p = Object.fromEntries(dateBlock.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return { month: p.month.toUpperCase(), day: p.day, year: p.year };
}

function InterviewItem({ interview, onConfirm }) {
  const { month, day, year } = dateParts(interview.scheduledAt);
  const pending = interview.status === INTERVIEW_STATUS.PENDING_CONFIRMATION;
  return (
    <li className="grid grid-cols-1 gap-4 sm:grid-cols-[88px_1fr]">
      <div className="flex h-fit flex-row items-center justify-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-center sm:flex-col sm:gap-0 sm:py-3">
        <span className="text-label-sm font-semibold text-primary">{month}</span>
        <span className="text-section-title font-bold text-primary tabular">{day}</span>
        <span className="text-caption text-muted-foreground">{year}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body font-semibold text-heading">{interview.jobTitle}</h3>
          <StatusBadge kind="interview" value={interview.status} />
        </div>
        <ul className="flex flex-col gap-1.5 text-body-sm text-text">
          <li className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0" aria-hidden="true" />
            {manilaTimeRange(interview.scheduledAt, interview.durationMinutes)} (Philippine time)
          </li>
          <li className="flex items-center gap-2">
            <Video className="size-4 shrink-0" aria-hidden="true" />
            Online interview
          </li>
          {interview.interviewerName && (
            <li className="flex items-center gap-2">
              <UserRound className="size-4 shrink-0" aria-hidden="true" />
              Interviewer: {interview.interviewerName}
            </li>
          )}
        </ul>
        {pending ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-body-sm text-text">
              Please confirm by {formatDateTime(interview.confirmDueAt)} (Philippine time). The meeting link appears once you confirm.
            </p>
            <Button size="sm" onClick={onConfirm}>
              <CheckCircle2 aria-hidden="true" />
              Confirm attendance
            </Button>
          </div>
        ) : (
          interview.meetingLink && (
            <a
              href={interview.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-start text-body-sm font-semibold break-all text-primary hover:underline"
            >
              Join the online interview
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          )
        )}
      </div>
    </li>
  );
}

/**
 * Dashboard "Upcoming interview" card (UI_GUIDELINES §6, from the legacy UpcomingInterview mock) plus the
 * confirmation pop-up, which opens by itself while an interview awaits confirmation. Closing it ("Cancel")
 * hides it until the next visit; the card keeps the Confirm attendance button.
 */
export function InterviewCard() {
  const interviews = useMyInterviews();
  const [dismissed, setDismissed] = useState(null); // interviewId the applicant closed the pop-up for
  const [chosen, setChosen] = useState(null); // opened from the card's button

  const awaiting = interviews.data?.find((i) => i.status === INTERVIEW_STATUS.PENDING_CONFIRMATION) ?? null;
  const popup = chosen ?? (awaiting && awaiting.interviewId !== dismissed ? awaiting : null);

  return (
    <section aria-labelledby="upcoming-interview-title" className="rounded-md border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <h2 id="upcoming-interview-title" className="text-card-title font-semibold">
          Upcoming interview
        </h2>
      </div>

      {interviews.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : interviews.isError ? (
        <div className="flex flex-col items-start gap-2 text-body text-muted-foreground">
          <p className="flex items-center gap-2">
            <AlertCircle className="size-4 text-error" aria-hidden="true" />
            Your interview could not be loaded.
          </p>
          <Button variant="secondary" size="sm" onClick={() => interviews.refetch()}>
            Try again
          </Button>
        </div>
      ) : interviews.data.length === 0 ? (
        <p className="text-body text-muted-foreground">No interview scheduled. When the agency schedules one, it appears here.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-5">
            {interviews.data.map((i) => (
              <InterviewItem key={i.interviewId} interview={i} onConfirm={() => setChosen(i)} />
            ))}
          </ul>
          <p className="mt-5 flex gap-2 rounded-md bg-info-soft p-3 text-body-sm text-text">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            Please be on time. Can't attend? Please contact Confiable Manpower.
          </p>
        </>
      )}

      {popup && (
        <InterviewConfirmDialog
          key={popup.interviewId}
          interview={popup}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDismissed(popup.interviewId);
              setChosen(null);
            }
          }}
        />
      )}
    </section>
  );
}
