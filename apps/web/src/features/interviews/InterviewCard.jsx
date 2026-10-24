import { INTERVIEW_STATUS } from "@vera/shared";
import { AlertCircle, Building2, CalendarClock, CalendarDays, Clock3, ExternalLink, Info, MapPin, UserRound, Video } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { manilaTimeRange } from "@/lib/manilaTime";

import { useMyInterviews } from "./api";
import { RequestRescheduleDialog } from "./RequestRescheduleDialog";

const dateBlock = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** { month: "OCT", day: "12", year: "2026" } in Philippine time. */
function dateParts(iso) {
  const p = Object.fromEntries(dateBlock.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return { month: p.month.toUpperCase(), day: p.day, year: p.year };
}

function DateBlock({ iso }) {
  const { month, day, year } = dateParts(iso);
  return (
    <div className="flex h-fit flex-row items-center justify-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-center sm:flex-col sm:gap-0 sm:py-3">
      <span className="text-label-sm font-semibold text-primary">{month}</span>
      <span className="text-section-title font-bold text-primary tabular">{day}</span>
      <span className="text-caption text-muted-foreground">{year}</span>
    </div>
  );
}

/** The agency's online interview: set when HR schedules it (decision 37, no confirmation), so the link shows at once. */
function InterviewItem({ interview, now, onReschedule }) {
  const requested = interview.status === INTERVIEW_STATUS.RESCHEDULE_REQUESTED;
  // Decision 20 / 37: only before the interview time, with requests left (the API re-checks)
  const canRequest = !requested && interview.requestsLeft > 0 && new Date(interview.scheduledAt).getTime() > now;
  return (
    <li className="grid grid-cols-1 gap-4 sm:grid-cols-[88px_1fr]">
      <DateBlock iso={interview.scheduledAt} />
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
        {requested ? (
          <p className="text-body-sm text-text">Reschedule requested. The agency will set a new time or keep this one.</p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            {interview.meetingLink && (
              <a
                href={interview.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 self-start text-body-sm font-semibold break-all text-primary hover:underline"
              >
                Join the online interview
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            )}
            {canRequest && (
              <Button size="sm" variant="secondary" onClick={onReschedule}>
                <CalendarClock aria-hidden="true" />
                Request reschedule
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Decision 37: the client's final interview (time and HR's details; never the company). No reschedule request. */
function FinalInterviewItem({ interview }) {
  return (
    <li className="grid grid-cols-1 gap-4 sm:grid-cols-[88px_1fr]">
      <DateBlock iso={interview.scheduledAt} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body font-semibold text-heading">{interview.jobTitle}</h3>
          <Badge variant="secondary">Final interview</Badge>
        </div>
        <ul className="flex flex-col gap-1.5 text-body-sm text-text">
          <li className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0" aria-hidden="true" />
            {formatDateTime(interview.scheduledAt)} (Philippine time)
          </li>
          <li className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            Final interview with the employer
          </li>
          {interview.details && (
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{interview.details}</span>
            </li>
          )}
        </ul>
      </div>
    </li>
  );
}

/**
 * Dashboard "Upcoming interviews" card (UI_GUIDELINES §6, from the legacy UpcomingInterview mock). Decision 37: the
 * applicant is only notified, so there is no confirmation pop-up; the agency interview shows its meeting link at once,
 * and the client's final interview is listed too.
 */
export function InterviewCard() {
  const interviews = useMyInterviews();
  const [rescheduling, setRescheduling] = useState(null); // decision 20: the interview to ask a new time for
  const [now] = useState(() => Date.now()); // read once per visit; the API re-checks the time
  const hasAgency = interviews.data?.some((i) => i.kind !== "final") ?? false;

  return (
    <section aria-labelledby="upcoming-interview-title" className="rounded-md border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <h2 id="upcoming-interview-title" className="text-card-title font-semibold">
          Upcoming interviews
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
            Your interviews could not be loaded.
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
            {interviews.data.map((i) =>
              i.kind === "final" ? (
                <FinalInterviewItem key={`final-${i.applicationId}`} interview={i} />
              ) : (
                <InterviewItem key={i.interviewId} interview={i} now={now} onReschedule={() => setRescheduling(i)} />
              ),
            )}
          </ul>
          <p className="mt-5 flex gap-2 rounded-md bg-info-soft p-3 text-body-sm text-text">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            {hasAgency
              ? "Please be on time. Can't attend? Request a new time before the interview (up to 2 requests) or contact Confiable Manpower."
              : "Please be on time. Can't attend? Please contact Confiable Manpower."}
          </p>
        </>
      )}

      {rescheduling && (
        <RequestRescheduleDialog
          key={`reschedule-${rescheduling.interviewId}`}
          interview={rescheduling}
          open
          onOpenChange={(open) => !open && setRescheduling(null)}
        />
      )}
    </section>
  );
}
