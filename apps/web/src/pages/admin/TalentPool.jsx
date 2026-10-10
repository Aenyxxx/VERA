import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { useApplicantPool } from "@/features/rematch/api";
import { OFFER_STATUS_LOOK, POOL_AVAILABILITY_LABELS, POOL_REASON_LABELS } from "@/features/rematch/labels";
import { formatDateTime } from "@/lib/format";

const columns = [
  {
    accessorKey: "applicantName",
    header: "Applicant",
    cell: ({ row }) => <span className="font-semibold text-heading">{row.original.applicantName}</span>,
  },
  {
    accessorKey: "poolReason",
    header: "Reason",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{POOL_REASON_LABELS[row.original.poolReason] ?? row.original.poolReason}</span>
        <span className="text-caption text-muted-foreground">{POOL_AVAILABILITY_LABELS[row.original.availability] ?? row.original.availability}</span>
      </div>
    ),
  },
  {
    accessorKey: "addedAt",
    header: "Added",
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.addedAt)}</span>,
  },
  {
    id: "source",
    header: "From",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.sourceJobTitle}</span>
        <span className="text-caption text-muted-foreground">{row.original.sourceCompanyName}</span>
      </div>
    ),
  },
  {
    id: "offer",
    header: "Latest rematch offer",
    enableSorting: false,
    cell: ({ row }) => {
      const { offerStatus, offerJobTitle, offerCompanyName } = row.original;
      const look = OFFER_STATUS_LOOK[offerStatus];
      if (!look) return <span className="text-muted-foreground">No offer</span>;
      return (
        <div className="flex flex-col items-start gap-1">
          <span>
            {offerJobTitle} <span className="text-muted-foreground">at {offerCompanyName}</span>
          </span>
          <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>
        </div>
      );
    },
  },
];

/**
 * Applicant Pool (S17, PRD FR-POOL-01 minimal): active pool entries of applicants with no ongoing or hired application,
 * with where they came from and their latest automatic rematch offer. No invitations (deferred, ROADMAP §6).
 */
export default function TalentPool() {
  const pool = useApplicantPool();

  return (
    <>
      <PageHeader
        title="Applicant Pool"
        description="Applicants who are free to apply again: did not pass, standby, not selected, not hired, or training failed. Not-hired applicants get an automatic rematch offer."
      />
      <DataTable
        columns={columns}
        data={pool.data}
        isLoading={pool.isPending}
        isError={pool.isError}
        onRetry={() => pool.refetch()}
        empty={{ title: "The applicant pool is empty", description: "Applicants appear here when an application ends without a hire." }}
      />
    </>
  );
}
