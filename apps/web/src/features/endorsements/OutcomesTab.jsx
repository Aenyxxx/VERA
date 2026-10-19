import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS } from "@vera/shared";
import { CalendarClock, CircleX, Loader2, Printer, RefreshCw, ThumbsUp, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldError } from "@/components/shared/FieldError";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRunRematch } from "@/features/rematch/api";
import { OFFER_STATUS_LOOK, rematchMessage } from "@/features/rematch/labels";
import { useCloseOutPreview } from "@/features/vacancies/api";
import { formatDateTime } from "@/lib/format";
import { manilaIso, manilaParts } from "@/lib/manilaTime";

import { useMarkForHiring, useRecordOutcome, useScheduleFinalInterview, useTrainingFailed } from "./api";

const A = APPLICATION_STATUS;

/** What "not hired" means at each step with the client (decision 15; PRD FR-END-07). */
const NOT_HIRED_MEANING = {
  [A.ENDORSED]: "declined before the final interview",
  [A.FINAL_INTERVIEW_SCHEDULED]: "did not continue after the final interview",
  [A.FOR_HIRING]: "decided not to hire",
};

const OUTCOME_LOOK = {
  pending: { label: "Waiting for the client", tone: "warning" },
  hired: { label: "Hired", tone: "success" },
  not_hired: { label: "Not hired", tone: "error" },
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What a hire does to the vacancy: fills it (with the close-out counts) or leaves it open for the others. */
function HireConsequence({ vacancy, preview, fills }) {
  const after = vacancy.hiredCount + 1;
  if (!fills) {
    return <p>After this, {after} of {vacancy.slotsNeeded} slots are filled; the vacancy stays open for the others.</p>;
  }
  if (preview.isPending) return <p>This fills the vacancy. Counting who the close-out moves…</p>;
  if (preview.isError) {
    return (
      <p>
        This fills the vacancy ({vacancy.slotsNeeded} of {vacancy.slotsNeeded} hired): it closes, and everyone still in the process moves to
        Not selected or Standby.
      </p>
    );
  }
  const { notSelected, standby, endorsed } = preview.counts;
  const waitingEndorsed = Math.max(endorsed - 1, 0); // the applicant being hired is endorsed too
  return (
    <>
      <p className="font-semibold">
        This fills {vacancy.jobTitle} ({vacancy.slotsNeeded} of {vacancy.slotsNeeded} hired): the vacancy closes.
      </p>
      <ul className="flex flex-col gap-1">
        <li>
          <span className="font-semibold tabular">{plural(notSelected, "applicant", "applicants")}</span> in the waiting pool, screening, or
          interview → <span className="font-semibold">Not selected</span>
        </li>
        <li>
          <span className="font-semibold tabular">{plural(standby + waitingEndorsed, "applicant", "applicants")}</span> (passed, notified,
          confirmed, or endorsed and still waiting for the client) → <span className="font-semibold">Standby</span>
        </li>
      </ul>
      <p>Everyone moved is notified and kept in the applicant pool.</p>
    </>
  );
}

/** Mark as hired (only at For hiring) / not hired, with the consequence and optional remarks. */
function OutcomeDialog({ item, outcome, vacancy, onClose }) {
  const record = useRecordOutcome();
  const hiring = outcome === "hired";
  const fills = hiring && vacancy.hiredCount + 1 >= vacancy.slotsNeeded;
  const preview = useCloseOutPreview(vacancy.vacancyId, fills);
  const [remarks, setRemarks] = useState("");

  function confirm() {
    record.mutate(
      { itemId: item.itemId, outcome, remarks: remarks.trim() || null },
      {
        onSuccess: (result) => {
          if (result.rematch) {
            // S17: not hired starts the automatic rematch; the response says what it did.
            const text = `Marked ${item.applicantName} as not hired. ${rematchMessage(result.rematch)}`;
            if (result.rematch.status === "failed") toast.error(text);
            else toast.success(text);
          } else {
            toast.success(
              result.vacancyStatus === "filled" && result.closeOut
                ? `Marked as hired. ${vacancy.jobTitle} is now filled: ${result.closeOut.notSelected} not selected, ${result.closeOut.standby} moved to standby.`
                : hiring
                  ? `Marked ${item.applicantName} as hired.`
                  : `Marked ${item.applicantName} as not hired.`,
            );
          }
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={hiring ? `Mark ${item.applicantName} as hired?` : `Mark ${item.applicantName} as not hired?`}
      description={
        hiring
          ? `${vacancy.companyName} hired ${item.applicantName}. They are told they are hired (never the company name) and cannot apply to other jobs while hired.`
          : `${vacancy.companyName} ${NOT_HIRED_MEANING[item.status] ?? "did not hire the applicant"}: ${item.applicantName} joins the applicant pool and can no longer apply to ${vacancy.companyName}'s jobs for 1 year; they can apply to other jobs, and VERA looks for another job for them.`
      }
      confirmLabel={hiring ? "Mark as hired" : "Mark as not hired"}
      destructive={!hiring}
      pending={record.isPending}
      error={record.error?.message}
      onConfirm={confirm}
    >
      <div className="flex flex-col gap-4">
        {hiring && (
          <div className="flex flex-col gap-1.5 rounded-md bg-surface-subtle p-3 text-body-sm text-text">
            <HireConsequence vacancy={vacancy} preview={preview} fills={fills} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="outcome-remarks">Remarks (HR only, optional)</Label>
          <Textarea id="outcome-remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
    </ConfirmDialog>
  );
}

/**
 * Decision 14: HR encodes the client's final interview (Philippine time) and optional instructions; VERA sends them
 * to the applicant (never the company: the API refuses details that name it). Also used to change the time.
 */
function FinalInterviewDialog({ item, onClose }) {
  const schedule = useScheduleFinalInterview();
  const rescheduling = item.status === A.FINAL_INTERVIEW_SCHEDULED;
  const current = item.clientInterviewAt ? manilaParts(item.clientInterviewAt) : { date: "", time: "" };
  const [date, setDate] = useState(rescheduling ? current.date : "");
  const [time, setTime] = useState(rescheduling ? current.time : "");
  const [details, setDetails] = useState(rescheduling ? (item.finalInterviewDetails ?? "") : "");
  const [error, setError] = useState("");

  function confirm() {
    const scheduledAt = manilaIso(date, time);
    if (!scheduledAt) {
      setError("Enter the date and the time.");
      return;
    }
    schedule.mutate(
      { itemId: item.itemId, scheduledAt, details: details.trim() || null },
      {
        onSuccess: () => {
          toast.success(
            rescheduling
              ? `Final interview time changed. ${item.applicantName} was notified.`
              : `Final interview scheduled. ${item.applicantName} was notified.`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={rescheduling ? `Change ${item.applicantName}'s final interview` : `Schedule ${item.applicantName}'s final interview`}
      description="Enter the time the client gave. The applicant is notified with the job title, this time, and your instructions, never the company name."
      confirmLabel={rescheduling ? "Save and notify" : "Schedule and notify"}
      pending={schedule.isPending}
      error={schedule.error?.message}
      onConfirm={confirm}
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-body font-semibold text-heading">Final interview (Philippine time)</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="final-interview-date">Date</Label>
              <Input id="final-interview-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="final-interview-time">Time</Label>
              <Input id="final-interview-time" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(""); }} />
            </div>
          </div>
          <FieldError id="final-interview-error" message={error} />
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="final-interview-details">Instructions for the applicant (optional, no company name)</Label>
          <Textarea id="final-interview-details" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
        </div>
      </div>
    </ConfirmDialog>
  );
}

/** Decision 15: the applicant proceeds after the final interview → For hiring (no time check). */
function ForHiringDialog({ item, onClose }) {
  const forHiring = useMarkForHiring();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Mark ${item.applicantName} as For hiring?`}
      description={`${item.applicantName} passed the client's final interview. They are notified (never the company name); then record the client's hiring decision.`}
      confirmLabel="Mark as For hiring"
      pending={forHiring.isPending}
      error={forHiring.error?.message}
      onConfirm={() =>
        forHiring.mutate(item.itemId, {
          onSuccess: () => {
            toast.success(`${item.applicantName} is For hiring.`);
            onClose();
          },
        })
      }
    />
  );
}

/**
 * S17 (BR-23): a not-hired applicant's latest rematch offer (job, company, status) or "No offer yet", and Run rematch
 * again while no offer is pending or accepted. The API refuses (409) if the applicant is no longer free.
 */
function RematchInfo({ item }) {
  const run = useRunRematch();
  const look = OFFER_STATUS_LOOK[item.rematchStatus];
  const canRun = item.rematchStatus !== "pending" && item.rematchStatus !== "accepted";

  function rerun() {
    run.mutate(item.applicationId, {
      onSuccess: (result) => toast.success(`${item.applicantName}: ${rematchMessage(result)}`),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm">
      <span className="font-semibold text-heading">Rematch:</span>
      {look ? (
        <>
          <span className="text-text">
            {item.rematchJobTitle} at {item.rematchCompanyName}
          </span>
          <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>
        </>
      ) : (
        <span className="text-muted-foreground">No offer yet</span>
      )}
      {canRun && (
        <Button size="sm" variant="secondary" disabled={run.isPending} aria-label={`Run rematch again for ${item.applicantName}`} onClick={rerun}>
          {run.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Run rematch again
        </Button>
      )}
    </div>
  );
}

function TrainingFailedDialog({ item, vacancy, onClose }) {
  const trainingFailed = useTrainingFailed();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Mark ${item.applicantName}'s training as failed?`}
      description={`${item.applicantName}'s placement ends: they join the applicant pool and can no longer apply to ${vacancy.companyName}'s jobs; they can apply to other jobs. The vacancy stays filled.`}
      confirmLabel="Mark training failed"
      destructive
      pending={trainingFailed.isPending}
      error={trainingFailed.error?.message}
      onConfirm={() =>
        trainingFailed.mutate(item.applicationId, {
          onSuccess: () => {
            toast.success(`Marked ${item.applicantName}'s training as failed.`);
            onClose();
          },
        })
      }
    />
  );
}

/** Outcomes tab (FR-END-07/08/09): each endorsement batch with the client's decision per applicant. */
export function OutcomesTab({ data }) {
  const [deciding, setDeciding] = useState(null); // { item, outcome }
  const [failing, setFailing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [proceeding, setProceeding] = useState(null);
  const { vacancy, endorsements } = data;

  if (endorsements.length === 0) {
    return <EmptyState title="No endorsement yet" description="Create the endorsement from the Candidates tab first." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-muted-foreground">
        {vacancy.hiredCount} of {vacancy.slotsNeeded} slots filled. The vacancy fills, and closes out, when the last slot is hired.
      </p>
      {endorsements.map((e) => (
        <section key={e.endorsementId} aria-label={`Endorsement sent ${formatDateTime(e.sentAt)}`} className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-card-title font-semibold">Endorsement sent {formatDateTime(e.sentAt)}</h2>
            <Link to={`/admin/endorsements/${vacancy.vacancyId}/print/${e.endorsementId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Printer aria-hidden="true" />
              Printable page
            </Link>
          </div>
          <ul className="flex flex-col divide-y">
            {e.items.map((item) => {
              const look = OUTCOME_LOOK[item.outcome] ?? OUTCOME_LOOK.pending;
              return (
                <li key={item.itemId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-body font-semibold text-heading">
                      <span className="tabular">#{item.rank}</span> {item.applicantName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-sm text-muted-foreground">{APPLICANT_TYPE_LABELS[item.applicantType]}</span>
                      <ScoreChip kind="final" value={item.finalScore} />
                      <StatusBadge kind="application" value={item.status} />
                      <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>
                    </div>
                    {item.outcomeRemarks && <p className="text-body-sm text-text">Remarks: {item.outcomeRemarks}</p>}
                    {item.clientInterviewAt && (
                      <p className="text-body-sm text-muted-foreground">Final interview {formatDateTime(item.clientInterviewAt)} (Philippine time)</p>
                    )}
                    {item.finalInterviewDetails && <p className="text-body-sm text-text">Instructions: {item.finalInterviewDetails}</p>}
                    {item.status === APPLICATION_STATUS.NOT_HIRED && <RematchInfo item={item} />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === A.ENDORSED && (
                      <>
                        <Button size="sm" aria-label={`Schedule ${item.applicantName}'s final interview`} onClick={() => setScheduling(item)}>
                          <CalendarClock aria-hidden="true" />
                          Schedule final interview
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`Mark ${item.applicantName} as not hired`}
                          onClick={() => setDeciding({ item, outcome: "not_hired" })}
                        >
                          <UserX aria-hidden="true" />
                          Mark as not hired
                        </Button>
                      </>
                    )}
                    {item.status === A.FINAL_INTERVIEW_SCHEDULED && (
                      <>
                        <Button size="sm" aria-label={`${item.applicantName} proceeds: mark as For hiring`} onClick={() => setProceeding(item)}>
                          <ThumbsUp aria-hidden="true" />
                          Proceeds
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`${item.applicantName} did not proceed: mark as not hired`}
                          onClick={() => setDeciding({ item, outcome: "not_hired" })}
                        >
                          <UserX aria-hidden="true" />
                          Did not proceed
                        </Button>
                        <Button size="sm" variant="secondary" aria-label={`Change ${item.applicantName}'s final interview time`} onClick={() => setScheduling(item)}>
                          <CalendarClock aria-hidden="true" />
                          Change time
                        </Button>
                      </>
                    )}
                    {item.status === A.FOR_HIRING && (
                      <>
                        <Button size="sm" aria-label={`Mark ${item.applicantName} as hired`} onClick={() => setDeciding({ item, outcome: "hired" })}>
                          <UserCheck aria-hidden="true" />
                          Mark as hired
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`Mark ${item.applicantName} as not hired`}
                          onClick={() => setDeciding({ item, outcome: "not_hired" })}
                        >
                          <UserX aria-hidden="true" />
                          Mark as not hired
                        </Button>
                      </>
                    )}
                    {item.status === APPLICATION_STATUS.HIRED && (
                      <Button size="sm" variant="secondary" aria-label={`Mark ${item.applicantName}'s training as failed`} onClick={() => setFailing(item)}>
                        <CircleX aria-hidden="true" />
                        Training failed
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {deciding && <OutcomeDialog item={deciding.item} outcome={deciding.outcome} vacancy={vacancy} onClose={() => setDeciding(null)} />}
      {failing && <TrainingFailedDialog item={failing} vacancy={vacancy} onClose={() => setFailing(null)} />}
      {scheduling && <FinalInterviewDialog item={scheduling} onClose={() => setScheduling(null)} />}
      {proceeding && <ForHiringDialog item={proceeding} onClose={() => setProceeding(null)} />}
    </div>
  );
}
