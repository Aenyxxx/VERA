import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS } from "@vera/shared";
import { CircleX, Loader2, Printer, RefreshCw, UserCheck, UserX } from "lucide-react";
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
import { manilaIso } from "@/lib/manilaTime";

import { useRecordOutcome, useTrainingFailed } from "./api";

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

/** Mark as hired / not hired, with the consequence and the optional client interview date and remarks. */
function OutcomeDialog({ item, outcome, vacancy, onClose }) {
  const record = useRecordOutcome();
  const hiring = outcome === "hired";
  const fills = hiring && vacancy.hiredCount + 1 >= vacancy.slotsNeeded;
  const preview = useCloseOutPreview(vacancy.vacancyId, fills);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  function confirm() {
    let clientInterviewAt = null;
    if (date || time) {
      clientInterviewAt = date && time ? manilaIso(date, time) : null;
      if (!clientInterviewAt) {
        setError("Enter both the date and the time, or leave both empty.");
        return;
      }
    }
    record.mutate(
      { itemId: item.itemId, outcome, clientInterviewAt, remarks: remarks.trim() || null },
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
          : `${vacancy.companyName} did not hire ${item.applicantName}. They join the applicant pool and can no longer apply to ${vacancy.companyName}'s jobs; they can apply to other jobs.`
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
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-body font-semibold text-heading">Client interview (optional, Philippine time)</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="client-interview-date">Date</Label>
              <Input id="client-interview-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="client-interview-time">Time</Label>
              <Input id="client-interview-time" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(""); }} />
            </div>
          </div>
          <FieldError id="client-interview-error" message={error} />
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="outcome-remarks">Remarks (HR only, optional)</Label>
          <Textarea id="outcome-remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
    </ConfirmDialog>
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
                      <p className="text-body-sm text-muted-foreground">Client interview {formatDateTime(item.clientInterviewAt)} (Philippine time)</p>
                    )}
                    {item.status === APPLICATION_STATUS.NOT_HIRED && <RematchInfo item={item} />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === APPLICATION_STATUS.ENDORSED && (
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
    </div>
  );
}
