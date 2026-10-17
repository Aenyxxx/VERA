import { VACANCY_STATUS } from "@vera/shared";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OFFER_STATUS_LOOK } from "@/features/rematch/labels";
import { formatDateTime } from "@/lib/format";

import { useRunPoolMatching, useVacancyInvitations } from "./api";

const columns = [
  {
    accessorKey: "applicantName",
    header: "Applicant",
    cell: ({ row }) => <span className="font-semibold text-heading">{row.original.applicantName}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const look = OFFER_STATUS_LOOK[row.original.status];
      return look ? <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge> : row.original.status;
    },
  },
  {
    accessorKey: "matchingScore",
    header: "Matching",
    cell: ({ row }) => <ScoreChip kind="resume" value={row.original.matchingScore} />,
  },
  {
    accessorKey: "invitedAt",
    header: "Invited",
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.invitedAt)}</span>,
  },
  {
    accessorKey: "respondedAt",
    header: "Answered",
    cell: ({ row }) => <span className="tabular">{row.original.respondedAt ? formatDateTime(row.original.respondedAt) : "—"}</span>,
  },
];

/** The last run in words: running, never run, or the counts and when it finished. */
function RunSummary({ data }) {
  if (data.running) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-body text-text">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Pool matching is running…
      </p>
    );
  }
  if (!data.summary) return <p className="text-body text-muted-foreground">Pool matching has not run for this job yet.</p>;
  const { invited, skipped, failed } = data.summary;
  return (
    <p role="status" className="text-body text-text">
      Last run {formatDateTime(data.poolMatchedAt)} (Philippine time): <span className="font-semibold tabular">{invited}</span> invited,{" "}
      <span className="tabular">{skipped}</span> skipped, <span className="tabular">{failed}</span> failed.
    </p>
  );
}

/**
 * Pool invitations tab (Phase 3, decision 17d): when the job is published, VERA matches the applicant pool in the
 * background and invites everyone who passes the prescreen and the matching threshold (job title only, never the
 * company or a score). HR sees the last run and each invitation's answer, and can run the matching again while the job
 * is open (e.g. after svc failures).
 */
export function PoolInvitationsTab({ vacancy }) {
  const invitations = useVacancyInvitations(vacancy.vacancyId);
  const run = useRunPoolMatching(vacancy.vacancyId);
  const open = vacancy.status === VACANCY_STATUS.OPEN;

  function runAgain() {
    run.mutate(undefined, {
      onSuccess: () => toast.success("Pool matching started. The results appear here when it finishes."),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        {invitations.data ? <RunSummary data={invitations.data} /> : <span />}
        {open && (
          <Button variant="secondary" disabled={run.isPending || invitations.data?.running} onClick={runAgain}>
            {run.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Run pool matching again
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={invitations.data?.invitations}
        isLoading={invitations.isPending}
        isError={invitations.isError}
        onRetry={() => invitations.refetch()}
        empty={{
          title: "No invitations yet",
          description: "Applicants in the applicant pool who fit this job are invited when it is published.",
        }}
      />
    </div>
  );
}
