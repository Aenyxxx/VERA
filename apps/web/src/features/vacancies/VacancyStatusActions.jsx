import { VACANCY_STATUS, VACANCY_STATUS_LABELS } from "@vera/shared";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCloseOutPreview, useVacancyAction } from "./api";
import { actionsFor, VACANCY_ACTIONS } from "./status";

function copyFor(action, vacancy) {
  const name = vacancy.jobTitle;
  switch (action) {
    case "publish":
      return {
        title: `Publish ${name}?`,
        description:
          "Applicants will see it in Job Vacancies (without the company name). Requirements, prescreen, pipeline numbers, and weights are locked after publishing.",
      };
    case "close":
      return { title: `Close ${name}?`, description: "It is hidden from applicants and stops accepting applications. You can reopen it later." };
    case "reopen":
      return { title: `Reopen ${name}?`, description: "Applicants will see it again and can apply until the application cap is reached." };
    case "unarchive":
      // Decision 40-5: the API picks the status it would have now; nothing the archive changed is restored.
      return {
        title: `Unarchive ${name}?`,
        description:
          "It goes back to Closed (Filled if its Deployed applicants already fill the slots, Draft if it was never published). It is not opened: reopen it afterwards if you need applicants. Nothing else is restored: applicants moved when it was archived stay Not selected or Standby, and expired invitations stay expired. No one is notified.",
      };
    default:
      // Decision 40-3: a filled vacancy's close-out already ran at the fill, so archiving it changes nothing else.
      return vacancy.status === VACANCY_STATUS.FILLED
        ? {
            title: `Archive ${name}?`,
            description:
              "It is kept as a record and can no longer be edited, published, or reopened unless you unarchive it. It is already filled, so nothing else changes: deployed applicants and every application stay as they are.",
          }
        : {
            title: `Archive ${name}?`,
            description:
              "It is kept as a record and can no longer be edited, published, or reopened unless you unarchive it. Archiving closes out every open application (below).",
          };
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What the archive's close-out will do (BR-22, S15), with counts; archiving is refused while anyone is endorsed. */
function CloseOutSummary({ preview }) {
  if (preview.isPending) return <p className="text-body-sm text-muted-foreground">Counting the open applications…</p>;
  if (preview.isError) {
    return (
      <p className="text-body-sm text-text">
        Open applications become Not selected (waiting, screening, interview) or Standby (passed, notified, confirmed); everyone
        moved is notified and kept in the applicant pool. Archiving is refused while any applicant is endorsed.
      </p>
    );
  }
  const { notSelected, standby, endorsed } = preview.counts;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3 text-body-sm text-text">
      <ul className="flex flex-col gap-1">
        <li>
          <span className="font-semibold tabular">{plural(notSelected, "applicant", "applicants")}</span> in the waiting pool,
          screening, or interview → <span className="font-semibold">Not selected</span>
        </li>
        <li>
          <span className="font-semibold tabular">{plural(standby, "passed applicant", "passed applicants")}</span> (incl. notified or
          confirmed) → <span className="font-semibold">Standby</span>
        </li>
      </ul>
      <p>Everyone moved is notified and kept in the applicant pool. They are not blocked from this company&apos;s other jobs.</p>
      {endorsed > 0 ? (
        <p role="alert" className="rounded-sm bg-error-soft px-2 py-1 text-error">
          {plural(endorsed, "applicant is", "applicants are")} endorsed and waiting for the client&apos;s decision: archiving is refused until
          you record it.
        </p>
      ) : (
        <p className="text-muted-foreground">Archiving is refused while any applicant is endorsed (none now).</p>
      )}
    </div>
  );
}

/**
 * Publish / Close / Reopen / Archive / Unarchive with a confirmation each (FR-VAC-03). Reopen at the cap asks for a higher
 * cap (FR-VAC-07). Unarchive (decision 40-5) shows only on an archived vacancy.
 */
export function VacancyStatusActions({ vacancy }) {
  const mutation = useVacancyAction(vacancy.vacancyId);
  const [action, setAction] = useState(null);
  const filled = vacancy.status === VACANCY_STATUS.FILLED; // decision 40-3: archive moves nobody, no preview needed
  const preview = useCloseOutPreview(vacancy.vacancyId, action === "archive" && !filled);
  const [newCap, setNewCap] = useState("");
  const [capError, setCapError] = useState("");

  const atCap = vacancy.applicationCount >= vacancy.applicationCap;
  const needsCap = action === "reopen" && atCap;

  function open(next) {
    mutation.reset();
    setCapError("");
    setNewCap(String(vacancy.applicationCount + 1));
    setAction(next);
  }

  function confirm() {
    let body;
    if (needsCap) {
      const cap = Number(newCap);
      if (!Number.isInteger(cap) || cap <= vacancy.applicationCount) {
        setCapError(`Use more than ${vacancy.applicationCount} (the qualified applications so far)`);
        return;
      }
      body = { applicationCap: cap };
    }
    mutation.mutate(
      { action, body },
      {
        onSuccess: (result) => {
          const closeOut = result?.closeOut;
          toast.success(
            closeOut && !filled
              ? `${VACANCY_ACTIONS[action].done}: ${closeOut.notSelected} not selected, ${closeOut.standby} moved to standby.`
              : result?.poolMatching === "started"
                ? `${VACANCY_ACTIONS[action].done}. Pool matching is running: see Pool invitations.` // Phase 3, decision 17c
                : action === "unarchive" && VACANCY_STATUS_LABELS[result?.status]
                  ? `${VACANCY_ACTIONS[action].done}: now ${VACANCY_STATUS_LABELS[result.status].label}.` // decision 40-5
                  : VACANCY_ACTIONS[action].done,
          );
          setAction(null);
        },
      },
    );
  }

  const available = actionsFor(vacancy.status);
  const copy = action ? copyFor(action, vacancy) : null;

  return (
    <>
      {available.map((name) => (
        <Button
          key={name}
          variant={name === "publish" || name === "reopen" ? "default" : name === "archive" ? "destructive" : "secondary"}
          onClick={() => open(name)}
        >
          {VACANCY_ACTIONS[name].label}
        </Button>
      ))}

      {action && (
        <ConfirmDialog
          open
          onOpenChange={(isOpen) => !isOpen && setAction(null)}
          title={copy.title}
          description={copy.description}
          confirmLabel={needsCap ? "Raise cap and reopen" : VACANCY_ACTIONS[action].label}
          destructive={action === "archive"}
          pending={mutation.isPending}
          error={mutation.error?.message}
          onConfirm={confirm}
        >
          {action === "archive" && !filled && <CloseOutSummary preview={preview} />}
          {needsCap && (
            <div className="flex flex-col gap-1.5">
              <p className="text-body text-warning">
                Qualified applications ({vacancy.applicationCount}) have reached the cap of {vacancy.applicationCap}. Raise
                the application cap to reopen.
              </p>
              <Label htmlFor="newCap">New application cap</Label>
              <Input
                id="newCap"
                type="number"
                min={vacancy.applicationCount + 1}
                step="1"
                value={newCap}
                aria-invalid={Boolean(capError)}
                onChange={(event) => {
                  setNewCap(event.target.value);
                  setCapError("");
                }}
              />
              <FieldError id="newCap-error" message={capError} />
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
