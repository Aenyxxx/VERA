import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS } from "@vera/shared";
import { ArrowRight, CalendarClock, CircleX, Printer, ThumbsUp, UserCheck, UserX } from "lucide-react";
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
import { rematchMessage } from "@/features/rematch/labels";
import { useCloseOutPreview } from "@/features/vacancies/api";
import { formatDateTime } from "@/lib/format";
import { manilaIso, manilaParts } from "@/lib/manilaTime";

import { useAdvanceStage, useRecordOutcome, useScheduleFinalInterview, useTrainingFailed } from "./api";
import { StageTracker } from "./StageTracker";

const A = APPLICATION_STATUS;

/** What "not hired" means at each step with the client (decision 15 + 37C; PRD FR-END-07). */
const NOT_HIRED_MEANING = {
  [A.ENDORSED]: "declined before the final interview",
  [A.FINAL_INTERVIEW_SCHEDULED]: "did not continue after the final interview",
  [A.FOR_TRAINING]: "decided not to hire during training",
  [A.FOR_REQUIREMENTS]: "decided not to hire at the requirements step",
  [A.FOR_ORIENTATION]: "decided not to hire at orientation",
  [A.FOR_HIRING]: "decided not to hire",
};

const OUTCOME_LOOK = {
  pending: { label: "Waiting for the client", tone: "warning" },
  hired: { label: "Deployed", tone: "success" },
  not_hired: { label: "Not hired", tone: "error" },
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Decision 37C: one stage forward (the API refuses anything else). */
const ADVANCE = {
  [A.FINAL_INTERVIEW_SCHEDULED]: {
    to: A.FOR_TRAINING,
    button: "Proceed",
    title: (name) => `Move ${name} to For training?`,
    description: (name) => `${name} passed the client's final interview and moves on to training. They are notified (never the company name).`,
    confirm: "Proceed to training",
    done: (name) => `${name} is For training.`,
  },
  [A.FOR_TRAINING]: {
    to: A.FOR_REQUIREMENTS,
    button: "Training passed",
    title: (name) => `Mark ${name}'s training as passed?`,
    description: (name) => `${name} moves to For requirements and is notified to prepare the pre-employment requirements.`,
    confirm: "Training passed",
    done: (name) => `${name} is For requirements.`,
  },
  [A.FOR_REQUIREMENTS]: {
    to: A.FOR_ORIENTATION,
    button: "For orientation",
    title: (name) => `Move ${name} to For orientation?`,
    description: (name) => `${name} completed the requirements and moves to orientation. They are notified.`,
    confirm: "Move to orientation",
    done: (name) => `${name} is For orientation.`,
  },
};

/** Deployed (the hired outcome) only at the last stage, or from an old For hiring row. */
const DEPLOYABLE = [A.FOR_ORIENTATION, A.FOR_HIRING];
/** Not hired is allowed at every step with the client, before Deployed. */
const CAN_NOT_HIRE = [A.ENDORSED, A.FINAL_INTERVIEW_SCHEDULED, A.FOR_TRAINING, A.FOR_REQUIREMENTS, A.FOR_ORIENTATION, A.FOR_HIRING];

/** What a deployment does to the vacancy: fills it (with the close-out counts) or leaves it open for the others. */
function HireConsequence({ vacancy, preview, fills }) {
  const after = vacancy.hiredCount + 1;
  if (!fills) {
    return <p>After this, {after} of {vacancy.slotsNeeded} slots are filled; the vacancy stays open for the others.</p>;
  }
  if (preview.isPending) return <p>This fills the vacancy. Counting who the close-out moves…</p>;
  if (preview.isError) {
    return (
      <p>
        This fills the vacancy ({vacancy.slotsNeeded} of {vacancy.slotsNeeded} deployed): it closes, and everyone still in the process moves to
        Not selected or Standby.
      </p>
    );
  }
  const { notSelected, standby, endorsed } = preview.counts;
  const waitingEndorsed = Math.max(endorsed - 1, 0); // the applicant being deployed is with the client too
  return (
    <>
      <p className="font-semibold">
        This fills {vacancy.jobTitle} ({vacancy.slotsNeeded} of {vacancy.slotsNeeded} deployed): the vacancy closes.
      </p>
      <ul className="flex flex-col gap-1">
        <li>
          <span className="font-semibold tabular">{plural(notSelected, "applicant", "applicants")}</span> in the waiting pool, screening, or
          interview → <span className="font-semibold">Not selected</span>
        </li>
        <li>
          <span className="font-semibold tabular">{plural(standby + waitingEndorsed, "applicant", "applicants")}</span> (passed, notified,
          or still with the client) → <span className="font-semibold">Standby</span>
        </li>
      </ul>
      <p>Everyone moved is notified and kept in the applicant pool.</p>
    </>
  );
}

/** Mark as deployed (only at For orientation) / not hired, with the consequence and optional remarks. */
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
                ? `Marked as deployed. ${vacancy.jobTitle} is now filled: ${result.closeOut.notSelected} not selected, ${result.closeOut.standby} moved to standby.`
                : hiring
                  ? `Marked ${item.applicantName} as deployed.`
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
      title={hiring ? `Mark ${item.applicantName} as deployed?` : `Mark ${item.applicantName} as not hired?`}
      description={
        hiring
          ? `${vacancy.companyName} hired ${item.applicantName}, who completed orientation. They are told they are deployed (never the company name) and cannot apply to other jobs while deployed.`
          : `${vacancy.companyName} ${NOT_HIRED_MEANING[item.status] ?? "did not hire the applicant"}: ${item.applicantName} joins the applicant pool and can no longer apply to ${vacancy.companyName}'s jobs for 1 year; they can apply to other jobs, and VERA looks for another job for them.`
      }
      confirmLabel={hiring ? "Mark as deployed" : "Mark as not hired"}
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

/** Decision 37C: one stage forward (no time check); the applicant is notified. */
function AdvanceDialog({ item, onClose }) {
  const advance = useAdvanceStage();
  const step = ADVANCE[item.status];
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={step.title(item.applicantName)}
      description={step.description(item.applicantName)}
      confirmLabel={step.confirm}
      pending={advance.isPending}
      error={advance.error?.message}
      onConfirm={() =>
        advance.mutate(
          { itemId: item.itemId, to: step.to },
          {
            onSuccess: () => {
              toast.success(step.done(item.applicantName));
              onClose();
            },
          },
        )
      }
    />
  );
}

/** Decision 37C: Training failed only at For training (before Deployed). */
function TrainingFailedDialog({ item, vacancy, onClose }) {
  const trainingFailed = useTrainingFailed();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Mark ${item.applicantName}'s training as failed?`}
      description={`${item.applicantName} does not continue: they join the applicant pool (Returned by Client) and can no longer apply to ${vacancy.companyName}'s jobs; they can apply to other jobs.`}
      confirmLabel="Mark training failed"
      destructive
      pending={trainingFailed.isPending}
      error={trainingFailed.error?.message}
      onConfirm={() =>
        trainingFailed.mutate(item.itemId, {
          onSuccess: () => {
            toast.success(`Marked ${item.applicantName}'s training as failed.`);
            onClose();
          },
        })
      }
    />
  );
}

/**
 * Outcomes tab (FR-END-07/08/09; decision 37C): each endorsement batch with a stage tracker per applicant and only the
 * next valid buttons. Not hired and Training failed rows are left out by the API (they are in the Applicant Pool,
 * Returned by Client, where Run rematch again is); a batch with no row left keeps its Printable page.
 */
export function OutcomesTab({ data }) {
  const [deciding, setDeciding] = useState(null); // { item, outcome }
  const [failing, setFailing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [advancing, setAdvancing] = useState(null);
  const { vacancy, endorsements } = data;

  if (endorsements.length === 0) {
    return <EmptyState title="No endorsement yet" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-muted-foreground">
        {vacancy.hiredCount} of {vacancy.slotsNeeded} slots filled. The vacancy fills, and closes out, when the last slot is deployed.
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
          {e.items.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">No applicant from this endorsement is still with the client.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {e.items.map((item) => {
                const look = OUTCOME_LOOK[item.outcome] ?? OUTCOME_LOOK.pending;
                const step = ADVANCE[item.status];
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
                      <StageTracker status={item.status} />
                      {item.outcomeRemarks && <p className="text-body-sm text-text">Remarks: {item.outcomeRemarks}</p>}
                      {item.clientInterviewAt && (
                        <p className="text-body-sm text-muted-foreground">Final interview {formatDateTime(item.clientInterviewAt)} (Philippine time)</p>
                      )}
                      {item.finalInterviewDetails && <p className="text-body-sm text-text">Instructions: {item.finalInterviewDetails}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status === A.ENDORSED && (
                        <Button size="sm" aria-label={`Schedule ${item.applicantName}'s final interview`} onClick={() => setScheduling(item)}>
                          <CalendarClock aria-hidden="true" />
                          Schedule final interview
                        </Button>
                      )}
                      {item.status === A.FINAL_INTERVIEW_SCHEDULED && (
                        <Button size="sm" variant="secondary" aria-label={`Change ${item.applicantName}'s final interview time`} onClick={() => setScheduling(item)}>
                          <CalendarClock aria-hidden="true" />
                          Change time
                        </Button>
                      )}
                      {step && (
                        <Button size="sm" aria-label={`${item.applicantName}: ${step.button}`} onClick={() => setAdvancing(item)}>
                          {item.status === A.FINAL_INTERVIEW_SCHEDULED ? <ThumbsUp aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                          {step.button}
                        </Button>
                      )}
                      {item.status === A.FOR_TRAINING && (
                        <Button size="sm" variant="secondary" aria-label={`Mark ${item.applicantName}'s training as failed`} onClick={() => setFailing(item)}>
                          <CircleX aria-hidden="true" />
                          Training failed
                        </Button>
                      )}
                      {DEPLOYABLE.includes(item.status) && (
                        <Button size="sm" aria-label={`Mark ${item.applicantName} as deployed`} onClick={() => setDeciding({ item, outcome: "hired" })}>
                          <UserCheck aria-hidden="true" />
                          Mark as deployed
                        </Button>
                      )}
                      {CAN_NOT_HIRE.includes(item.status) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`Mark ${item.applicantName} as not hired`}
                          onClick={() => setDeciding({ item, outcome: "not_hired" })}
                        >
                          <UserX aria-hidden="true" />
                          Not hired
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {deciding && <OutcomeDialog item={deciding.item} outcome={deciding.outcome} vacancy={vacancy} onClose={() => setDeciding(null)} />}
      {failing && <TrainingFailedDialog item={failing} vacancy={vacancy} onClose={() => setFailing(null)} />}
      {scheduling && <FinalInterviewDialog item={scheduling} onClose={() => setScheduling(null)} />}
      {advancing && <AdvanceDialog item={advancing} onClose={() => setAdvancing(null)} />}
    </div>
  );
}
