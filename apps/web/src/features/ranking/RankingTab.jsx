import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, successProbabilityFor } from "@vera/shared";
import { BarChart3, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/format";

import { useRanking } from "./api";
import { NotifyDialog } from "./NotifyDialog";
import { ScoreBreakdownDialog } from "./ScoreBreakdownDialog";

/**
 * Final ranking tab (FR-END-01, FR-VAC-06, FR-END-03; S15): every evaluated application of the vacancy, both groups in
 * one list, in the API's RANK-03 order. Only passed applicants can be selected for Notify, at most the places left in
 * the endorsement; the top passed ones are preselected (decision support: HR may pick others).
 */
export function RankingTab({ vacancyId }) {
  const ranking = useRanking(vacancyId);
  const [picked, setPicked] = useState(null); // null = the default selection (top passed up to the places left)
  const [notifying, setNotifying] = useState(false);
  const [breakdown, setBreakdown] = useState(null);

  const rows = useMemo(() => ranking.data?.ranking ?? [], [ranking.data]);
  const vacancy = ranking.data?.vacancy;
  const remaining = vacancy?.canNotify ? vacancy.notifyRemaining : 0;
  const passed = rows.filter((r) => r.status === APPLICATION_STATUS.PASSED);
  const selected = picked ?? passed.slice(0, remaining).map((r) => r.applicationId);
  const full = selected.length >= remaining;

  function toggle(applicationId, on) {
    const next = on ? [...selected, applicationId] : selected.filter((id) => id !== applicationId);
    setPicked(next);
  }

  const columns = [
    {
      id: "select",
      header: () => <span className="sr-only">Select</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status !== APPLICATION_STATUS.PASSED) return null;
        const checked = selected.includes(r.applicationId);
        return (
          <Checkbox
            aria-label={`Select ${r.applicantName}`}
            checked={checked}
            disabled={!vacancy.canNotify || (!checked && full)}
            onCheckedChange={(on) => toggle(r.applicationId, on)}
          />
        );
      },
    },
    { accessorKey: "rank", header: "Rank", cell: ({ row }) => <span className="font-semibold tabular">{row.original.rank}</span> },
    {
      accessorKey: "applicantName",
      header: "Applicant",
      cell: ({ row }) => (
        <div className="flex min-w-36 flex-col">
          <span className="font-semibold text-heading">{row.original.applicantName}</span>
          <span className="text-body-sm text-muted-foreground">
            {APPLICANT_TYPE_LABELS[row.original.applicantType]}
            {row.original.reused ? " · reused ratings" : ""}
          </span>
        </div>
      ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge kind="application" value={row.original.status} /> },
    { accessorKey: "matchingScore", header: "Matching", cell: ({ row }) => <ScoreChip kind="resume" value={row.original.matchingScore} /> },
    { accessorKey: "interviewScore", header: "Interview", cell: ({ row }) => <ScoreChip kind="interview" value={row.original.interviewScore} /> },
    { accessorKey: "finalScore", header: "Final", cell: ({ row }) => <ScoreChip kind="final" value={row.original.finalScore} /> },
    {
      accessorKey: "overallRating",
      header: "Overall rating",
      cell: ({ row }) => (
        <span className="text-body-sm" title={successProbabilityFor(row.original.interviewScore).description}>
          <span className="font-semibold tabular">{row.original.overallRating}</span> {successProbabilityFor(row.original.interviewScore).label}
        </span>
      ),
    },
    {
      accessorKey: "actionDueAt",
      header: "Confirm by",
      cell: ({ row }) =>
        row.original.status === APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION && row.original.actionDueAt ? (
          <span className="text-body-sm">{formatDateTime(row.original.actionDueAt)}</span>
        ) : (
          <span className="text-body-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "details",
      header: () => <span className="sr-only">Details</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" aria-label={`Score breakdown for ${row.original.applicantName}`} onClick={() => setBreakdown(row.original)}>
          <BarChart3 aria-hidden="true" />
          Breakdown
        </Button>
      ),
    },
  ];

  const chosen = rows.filter((r) => selected.includes(r.applicationId));

  return (
    <div className="flex flex-col gap-4">
      {vacancy && (
        <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-body font-semibold text-heading">
              {vacancy.canNotify
                ? `${selected.length} of ${remaining} selected`
                : "Notify is closed for this vacancy"}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {vacancy.canNotify
                ? `Places left in the endorsement: ${remaining} of ${vacancy.endorsementCount} (notified, confirmed, and endorsed applicants use a place). Only passed applicants can be notified.`
                : `This vacancy is ${vacancy.status}; its applicants can no longer be notified.`}
            </p>
          </div>
          <Button className="self-start sm:self-auto" disabled={!vacancy.canNotify || selected.length === 0} onClick={() => setNotifying(true)}>
            <Send aria-hidden="true" />
            Notify ({selected.length})
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={ranking.isPending}
        isError={ranking.isError}
        onRetry={() => ranking.refetch()}
        empty={{
          title: "No ranking yet",
          description: "The final ranking appears here once applicants are interviewed and evaluated.",
        }}
      />

      {notifying && vacancy && (
        <NotifyDialog
          vacancy={vacancy}
          applicants={chosen}
          onClose={() => setNotifying(false)}
          onDone={() => {
            setNotifying(false);
            setPicked(null); // back to the default selection for the places still left
          }}
        />
      )}
      {breakdown && <ScoreBreakdownDialog row={breakdown} onClose={() => setBreakdown(null)} />}
    </div>
  );
}
