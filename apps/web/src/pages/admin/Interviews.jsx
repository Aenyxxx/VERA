import { APPLICANT_TYPE_LABELS, INTERVIEW_STATUS } from "@vera/shared";
import { CalendarCheck, CalendarClock, CalendarX, ClipboardCheck, ExternalLink, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDeclineReschedule, useInterviews, useMarkNoShow } from "@/features/interviews/api";
import { evaluateState, noShowState } from "@/features/interviews/rules";
import { ScheduleInterviewDialog } from "@/features/interviews/ScheduleInterviewDialog";
import { formatDateTime } from "@/lib/format";
import { manilaTimeRange } from "@/lib/manilaTime";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-80";

/** The current time, refreshed every 30 s so the no-show buttons enable themselves when the time comes. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Consequence text for Mark no-show: closed, company blocked for this applicant (BR-19), slot refilled. */
function noShowDescription(interview) {
  const why =
    interview.status === INTERVIEW_STATUS.CONFIRMED
      ? "The applicant did not attend the interview." // decision 37: set at once, never confirmed by the applicant
      : "The applicant did not confirm the interview by the deadline."; // old rows only
  return `${why} Their application for ${interview.jobTitle} is closed, they can no longer apply to ${interview.companyName}'s jobs, and the next applicant in line moves up automatically.`;
}

/**
 * Interview Assessment (APP_FLOW §4.3, S13/S14): one combined list of open interviews (both groups) across
 * vacancies, with a vacancy filter (?vacancy= or /admin/interviews/:vacancyId). HR evaluates once a confirmed
 * interview has started (S14), edits the time, or marks a no-show. Phase 4 (decision 20): a reschedule request
 * shows its reason; HR approves it with a new time or declines it (the time stays).
 */
export default function Interviews() {
  const interviews = useInterviews();
  const noShow = useMarkNoShow();
  const declineRequest = useDeclineReschedule();
  const now = useNow();
  const navigate = useNavigate();
  const { vacancyId } = useParams();
  const [searchParams] = useSearchParams();
  const vacancyFilter = vacancyId ?? searchParams.get("vacancy") ?? "";
  const [editing, setEditing] = useState(null);
  const [approving, setApproving] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [markingNoShow, setMarkingNoShow] = useState(null);

  const rows = useMemo(() => interviews.data ?? [], [interviews.data]);
  const vacancies = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.vacancyId, `${r.jobTitle} · ${r.companyName}`]));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const visible = vacancyFilter ? rows.filter((r) => r.vacancyId === vacancyFilter) : rows;

  const columns = [
    {
      accessorKey: "applicantName",
      header: "Applicant",
      cell: ({ row }) => (
        <div className="flex min-w-40 flex-col">
          <Link
            to={`/admin/screening/${row.original.vacancyId}/${row.original.applicationId}`}
            className="font-semibold text-heading hover:underline"
          >
            {row.original.applicantName}
          </Link>
          <span className="text-body-sm text-muted-foreground">{APPLICANT_TYPE_LABELS[row.original.applicantType]}</span>
        </div>
      ),
    },
    {
      accessorKey: "jobTitle",
      header: "Vacancy",
      cell: ({ row }) => (
        <div className="flex min-w-36 flex-col">
          <span className="text-heading">{row.original.jobTitle}</span>
          <span className="text-body-sm text-muted-foreground">{row.original.companyName}</span>
        </div>
      ),
    },
    {
      accessorKey: "matchingScore",
      header: "Matching",
      cell: ({ row }) => <ScoreChip kind="resume" value={row.original.matchingScore} />,
    },
    {
      accessorKey: "scheduledAt",
      header: "Interview (Philippine time)",
      cell: ({ row }) => {
        const i = row.original;
        return (
          <div className="flex min-w-48 flex-col">
            <span className="text-heading">{formatDateTime(i.scheduledAt)}</span>
            <span className="text-body-sm text-muted-foreground">
              {manilaTimeRange(i.scheduledAt, i.durationMinutes)} · {i.interviewerName ?? "No interviewer"}
            </span>
            <a
              href={i.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline"
            >
              Meeting link
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const i = row.original;
        return (
          <div className="flex min-w-40 flex-col items-start gap-1">
            <StatusBadge kind="interview" value={i.status} />
            {i.status === INTERVIEW_STATUS.RESCHEDULE_REQUESTED && (
              <>
                <span className="text-body-sm text-text">Reason: {i.rescheduleReason}</span>
                <span className="text-caption text-muted-foreground">Request {i.rescheduleRequests} of 2</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const i = row.original;
        const state = noShowState(i, now);
        const evaluate = evaluateState(i, now);
        const evaluateLabel = `Evaluate ${i.applicantName}`;
        if (i.status === INTERVIEW_STATUS.RESCHEDULE_REQUESTED) {
          return (
            <div className="flex min-w-72 flex-wrap gap-2">
              <Button size="sm" aria-label={`Approve the reschedule for ${i.applicantName}`} onClick={() => setApproving(i)}>
                <CalendarCheck aria-hidden="true" />
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Decline the reschedule for ${i.applicantName}`}
                onClick={() => {
                  declineRequest.reset();
                  setDeclining(i);
                }}
              >
                <CalendarX aria-hidden="true" />
                Decline
              </Button>
              <span className="w-full text-caption text-muted-foreground">Edit time, no-show, and evaluation wait for your answer</span>
            </div>
          );
        }
        return (
          <div className="flex min-w-72 flex-wrap gap-2">
            {evaluate.allowed ? (
              <Link
                to={`/admin/interviews/${i.vacancyId}/${i.applicationId}`}
                aria-label={evaluateLabel}
                className={buttonVariants({ size: "sm" })}
              >
                <ClipboardCheck aria-hidden="true" />
                Evaluate
              </Link>
            ) : (
              <Button size="sm" aria-label={evaluateLabel} disabled title={evaluate.reason ?? undefined}>
                <ClipboardCheck aria-hidden="true" />
                Evaluate
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Edit time for ${i.applicantName}`}
              onClick={() => setEditing(i)}
            >
              <CalendarClock aria-hidden="true" />
              Edit time
            </Button>
            <Button
              variant="destructive"
              size="sm"
              aria-label={`Mark ${i.applicantName} as no-show`}
              disabled={!state.allowed}
              title={state.reason ?? undefined}
              onClick={() => {
                noShow.reset();
                setMarkingNoShow(i);
              }}
            >
              <UserX aria-hidden="true" />
              Mark no-show
            </Button>
            {state.reason && <span className="w-full text-caption text-muted-foreground">{state.reason}</span>}
            {evaluate.reason && evaluate.reason !== state.reason && (
              <span className="w-full text-caption text-muted-foreground">{evaluate.reason}</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Interview Assessment" />

      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor="interview-vacancy-filter">Vacancy</Label>
        <select
          id="interview-vacancy-filter"
          className={selectClass}
          value={vacancyFilter}
          onChange={(event) =>
            navigate({ pathname: "/admin/interviews", search: event.target.value ? `?vacancy=${event.target.value}` : "" })
          }
        >
          <option value="">All vacancies</option>
          {vacancies.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={visible}
        isLoading={interviews.isPending}
        isError={interviews.isError}
        onRetry={() => interviews.refetch()}
        isFiltered={Boolean(vacancyFilter)}
        empty={{
          title: "No interviews scheduled",
          action: (
            <Link to="/admin/screening" className="font-semibold text-primary hover:underline">
              Go to Resume Screening
            </Link>
          ),
        }}
      />

      {editing && (
        <ScheduleInterviewDialog
          key={editing.interviewId}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          interview={editing}
          applicantName={editing.applicantName}
          jobTitle={editing.jobTitle}
          onDone={() => setEditing(null)}
        />
      )}

      {approving && (
        <ScheduleInterviewDialog
          key={`approve-${approving.interviewId}`}
          open
          approve
          onOpenChange={(open) => !open && setApproving(null)}
          interview={approving}
          applicantName={approving.applicantName}
          jobTitle={approving.jobTitle}
          onDone={() => setApproving(null)}
        />
      )}

      {declining && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeclining(null)}
          title={`Keep the current time for ${declining.applicantName}?`}
          description={`The applicant is told the interview stays on ${formatDateTime(declining.scheduledAt)} (Philippine time). The request still counts toward their 2 requests.`}
          confirmLabel="Decline request"
          pending={declineRequest.isPending}
          error={declineRequest.error?.message}
          onConfirm={() =>
            declineRequest.mutate(declining.interviewId, {
              onSuccess: () => {
                toast.success("Reschedule request declined. The applicant was notified.");
                setDeclining(null);
              },
            })
          }
        />
      )}

      {markingNoShow && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setMarkingNoShow(null)}
          title={`Mark ${markingNoShow.applicantName} as no-show?`}
          description={noShowDescription(markingNoShow)}
          confirmLabel="Mark no-show"
          destructive
          pending={noShow.isPending}
          error={noShow.error?.message}
          onConfirm={() =>
            noShow.mutate(markingNoShow.interviewId, {
              onSuccess: (result) => {
                const moved = result?.promoted?.length ?? 0;
                toast.success(
                  moved > 0
                    ? `Marked as no-show. ${moved} applicant${moved === 1 ? "" : "s"} moved up to the shortlist.`
                    : "Marked as no-show. The application is closed.",
                );
                setMarkingNoShow(null);
              },
            })
          }
        />
      )}
    </>
  );
}
