import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useVacancyAction } from "./api";
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
    default:
      return {
        title: `Archive ${name}?`,
        description: "It is kept as a record but can no longer be edited, published, or reopened.",
      };
  }
}

/** Publish / Close / Reopen / Archive with a confirmation each (FR-VAC-03). Reopen at the cap asks for a higher cap (FR-VAC-07). */
export function VacancyStatusActions({ vacancy }) {
  const mutation = useVacancyAction(vacancy.vacancyId);
  const [action, setAction] = useState(null);
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
        onSuccess: () => {
          toast.success(VACANCY_ACTIONS[action].done);
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
