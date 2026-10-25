import { VACANCY_STATUS } from "@vera/shared";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { useId, useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useArchiveCandidates, useArchiveVacancies } from "./api";
import { canBulkArchive } from "./status";

const vacancies = (n) => `${n} ${n === 1 ? "vacancy" : "vacancies"}`;

/** One line per archived vacancy: what its close-out moved (closed vacancies), or why it was refused. */
function Results({ results }) {
  return (
    <ul aria-label="Results" className="flex flex-col gap-2">
      {results.map((r) => (
        <li key={r.vacancyId} className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-body">
          {r.archived ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <CircleX className="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="font-semibold text-heading">{r.jobTitle}</span>
            {": "}
            {r.archived
              ? r.closeOut && r.closeOut.notSelected + r.closeOut.standby > 0
                ? `Archived (${r.closeOut.notSelected} not selected, ${r.closeOut.standby} moved to standby).`
                : "Archived."
              : `Not archived: ${r.message}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Decision 40-3: archive several vacancies at once. Lists only what can be archived (filled, or closed with nobody
 * still with the client), with checkboxes and Select all. Each chosen vacancy is archived through the single-vacancy
 * route, one transaction each (useArchiveVacancies); the dialog then shows a result per vacancy. The parent
 * remounts it (key) each time it opens.
 */
export function ArchiveVacanciesDialog({ open, onOpenChange }) {
  const candidates = useArchiveCandidates(open);
  const archive = useArchiveVacancies();
  const [selected, setSelected] = useState([]);
  const baseId = useId();

  const eligible = candidates.rows.filter(canBulkArchive);
  const leftOut = candidates.rows.filter((v) => v.status === VACANCY_STATUS.CLOSED && !canBulkArchive(v)).length;
  const allIds = eligible.map((v) => v.vacancyId);
  const results = archive.data;

  const toggle = (id, checked) => setSelected((ids) => (checked ? [...ids, id] : ids.filter((value) => value !== id)));
  const confirm = () => archive.mutate(eligible.filter((v) => selected.includes(v.vacancyId)));

  return (
    <Dialog open={open} onOpenChange={(next) => !archive.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Archive vacancies</DialogTitle>
        </DialogHeader>

        {results ? (
          <Results results={results} />
        ) : candidates.isPending ? (
          <Skeleton className="h-24 w-full rounded-lg" aria-label="Loading the vacancies" />
        ) : candidates.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-body text-text">The vacancies could not be loaded.</p>
            <Button variant="secondary" size="sm" onClick={candidates.refetch}>
              Try again
            </Button>
          </div>
        ) : eligible.length === 0 ? (
          <p className="text-body text-muted-foreground">No vacancies can be archived right now.</p>
        ) : (
          <div className="flex flex-col gap-2 p-0.5">
            <Label className="gap-3 border-b border-border px-3 pt-1 pb-2.5 font-semibold text-heading">
              <Checkbox
                checked={selected.length === allIds.length}
                onCheckedChange={(checked) => setSelected(checked === true ? allIds : [])}
              />
              Select all
            </Label>
            {eligible.map((v) => {
              const checked = selected.includes(v.vacancyId);
              const id = (part) => `${baseId}-${v.vacancyId}-${part}`; // the checkbox is named "{job} {company} {status}"
              return (
                <Label
                  key={v.vacancyId}
                  className={cn(
                    "min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 font-normal leading-normal transition-colors",
                    checked ? "border-primary bg-primary-soft" : "border-border hover:border-input",
                  )}
                >
                  <Checkbox
                    aria-labelledby={`${id("job")} ${id("company")} ${id("status")}`}
                    checked={checked}
                    onCheckedChange={(next) => toggle(v.vacancyId, next === true)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span id={id("job")} className="text-body font-semibold text-heading">
                      {v.jobTitle}
                    </span>
                    <span id={id("company")} className="text-body-sm text-muted-foreground">
                      {v.companyName}
                    </span>
                  </span>
                  <span id={id("status")}>
                    <StatusBadge kind="vacancy" value={v.status} />
                  </span>
                </Label>
              );
            })}
          </div>
        )}

        {!results && !candidates.isPending && !candidates.isError && leftOut > 0 && (
          <p className="text-body-sm text-muted-foreground">
            {leftOut === 1 ? "1 closed vacancy is" : `${leftOut} closed vacancies are`} not listed: someone is still with the
            client. Record the client&apos;s decision first.
          </p>
        )}

        <DialogFooter>
          {results ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={archive.isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirm}
                disabled={selected.length === 0 || archive.isPending}
                className="bg-destructive text-white hover:bg-destructive/90 hover:shadow-none"
              >
                {archive.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {selected.length === 0 ? "Archive vacancies" : `Archive ${vacancies(selected.length)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
