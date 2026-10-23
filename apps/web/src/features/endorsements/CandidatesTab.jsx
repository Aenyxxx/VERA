import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, VACANCY_STATUS } from "@vera/shared";
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { Button } from "@/components/ui/button";
import { useRanking } from "@/features/ranking/api";
import { EMPTY_FINAL_INTERVIEW, readFinalInterview } from "@/features/ranking/finalInterview";
import { FinalInterviewFields } from "@/features/ranking/FinalInterviewFields";

import { useCreateEndorsement } from "./api";

const CAN_ENDORSE = [VACANCY_STATUS.OPEN, VACANCY_STATUS.CLOSED, VACANCY_STATUS.ENDORSING];
const names = (rows) => rows.map((r) => r.applicantName).join(", ");

const TIME_CHANGED = "FINAL_INTERVIEW_CHANGED";

/**
 * The confirm names who is endorsed and who goes to standby (passed, never notified; FR-END-06). Decision 32: HR enters
 * the client's final interview once for the batch (the same as in the Notify message; nothing is prefilled because
 * the API has it only as message text). Everyone endorsed moves to Final interview. If it differs from what someone
 * was told, the API answers 409 FINAL_INTERVIEW_CHANGED with nothing written; HR then confirms again and those
 * applicants get "Final interview time changed".
 */
function CreateDialog({ data, onClose }) {
  const create = useCreateEndorsement();
  const ranking = useRanking(data.vacancy.vacancyId);
  const passed = (ranking.data?.ranking ?? []).filter((r) => r.status === APPLICATION_STATUS.PASSED);
  const { vacancy, candidates, awaitingConfirmation } = data;
  const [finalInterview, setFinalInterview] = useState(EMPTY_FINAL_INTERVIEW);
  const [finalErrors, setFinalErrors] = useState({});
  const [changedIds, setChangedIds] = useState(null); // set after a 409 FINAL_INTERVIEW_CHANGED

  function submit() {
    const schedule = readFinalInterview(finalInterview);
    setFinalErrors(schedule.errors ?? {});
    if (schedule.errors) return;
    create.mutate(
      { vacancyId: vacancy.vacancyId, ...schedule.value, acknowledgeChange: changedIds !== null },
      {
        onSuccess: (result) => {
          const changed = result.timeChanged?.length ?? 0;
          toast.success(
            `Endorsement created: ${result.endorsed.length} endorsed${result.standby.length ? `, ${result.standby.length} moved to standby` : ""}.` +
              (changed ? ` ${changed} applicant${changed === 1 ? " was" : "s were"} sent "Final interview time changed".` : ""),
          );
          onClose();
        },
        onError: (error) => {
          if (error.code === TIME_CHANGED) setChangedIds((error.details ?? []).map((d) => d.applicationId));
        },
      },
    );
  }

  const changedNames = names(candidates.filter((c) => changedIds?.includes(c.applicationId)));

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Create the endorsement for ${vacancy.jobTitle}?`}
      description={`${names(candidates)} will be endorsed to ${vacancy.companyName} with the final interview below. After this, print the endorsement page and send it to the client.`}
      confirmLabel={changedIds ? "Create and send 'time changed'" : "Create endorsement"}
      pending={create.isPending}
      error={create.error && create.error.code !== TIME_CHANGED ? create.error.message : undefined}
      onConfirm={submit}
    >
      <FinalInterviewFields
        idPrefix="endorse-final"
        value={finalInterview}
        errors={finalErrors}
        onChange={(next) => {
          setFinalInterview(next);
          setFinalErrors({});
          setChangedIds(null); // a new schedule is checked again
        }}
      />
      {changedIds && (
        <p role="alert" className="rounded-sm bg-warning-soft px-3 py-2 text-body text-text">
          This final interview differs from what {changedNames || "some applicants"} {changedIds.length === 1 ? "was" : "were"} told
          in the Notify message. If you continue, {changedIds.length === 1 ? "they get" : "each gets"} &quot;Final interview time
          changed&quot;. Otherwise, enter the schedule they were told.
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3 text-body-sm text-text">
        {ranking.isPending ? (
          <p className="text-muted-foreground">Checking the passed applicants…</p>
        ) : passed.length > 0 ? (
          <p>
            <span className="font-semibold">Moved to Standby (will not go forward to the employer):</span> {names(passed)}. They are
            notified and kept in the applicant pool.
          </p>
        ) : (
          <p>No other passed applicant moves to Standby.</p>
        )}
        {awaitingConfirmation > 0 && (
          <p>
            {awaitingConfirmation} notified applicant{awaitingConfirmation === 1 ? " has" : "s have"} not answered yet; they stay and can
            join a later endorsement.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

/** Candidates tab (FR-END-05): the confirmed applicants in ranking order and Create endorsement. */
export function CandidatesTab({ data }) {
  const [creating, setCreating] = useState(false);
  const { vacancy, candidates, awaitingConfirmation } = data;
  const canCreate = candidates.length > 0 && CAN_ENDORSE.includes(vacancy.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-body font-semibold text-heading">
            {candidates.length} confirmed for endorsement
          </p>
          {awaitingConfirmation > 0 && (
            <p className="text-body-sm text-muted-foreground">
              {`${awaitingConfirmation} notified applicant${awaitingConfirmation === 1 ? "" : "s"} still to answer.`}
            </p>
          )}
        </div>
        <Button className="self-start sm:self-auto" disabled={!canCreate} onClick={() => setCreating(true)}>
          <Send aria-hidden="true" />
          Create endorsement
        </Button>
      </div>

      {candidates.length === 0 ? (
        <EmptyState title="Nobody to endorse yet" />
      ) : (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li key={c.applicationId} className="flex flex-col gap-2 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-body font-semibold text-primary tabular">
                  {c.rank}
                </span>
                <div>
                  <p className="text-body font-semibold text-heading">{c.applicantName}</p>
                  <p className="text-body-sm text-muted-foreground">{APPLICANT_TYPE_LABELS[c.applicantType]}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ScoreChip kind="resume" value={c.matchingScore} />
                <ScoreChip kind="interview" value={c.interviewScore} />
                <ScoreChip kind="final" value={c.finalScore} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && <CreateDialog data={data} onClose={() => setCreating(false)} />}
    </div>
  );
}
