import { POOL_TABS } from "@vera/shared";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApplicantPool } from "@/features/rematch/api";
import { OFFER_KIND_LABELS, OFFER_STATUS_LOOK, POOL_AVAILABILITY_LABELS, POOL_REASON_LABELS } from "@/features/rematch/labels";
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
    header: "Latest offer or invitation",
    enableSorting: false,
    cell: ({ row }) => {
      const { offerStatus, offerKind, offerJobTitle, offerCompanyName } = row.original;
      const look = OFFER_STATUS_LOOK[offerStatus];
      if (!look) return <span className="text-muted-foreground">None</span>;
      return (
        <div className="flex flex-col items-start gap-1">
          <span>
            {offerJobTitle} <span className="text-muted-foreground">at {offerCompanyName}</span>
          </span>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{OFFER_KIND_LABELS[offerKind] ?? OFFER_KIND_LABELS.rematch_offer}</Badge>
            <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>
          </div>
        </div>
      );
    },
  },
];

const TAB_KEYS = Object.keys(POOL_TABS); // waiting, client

/**
 * Applicant Pool (PRD FR-POOL-01; decision 18): two tabs from @vera/shared POOL_TABS. "Waiting" = never reached the
 * client (screening up to the agency interview) plus standby; "Returned by Client" = not hired or training failed.
 * Free applicants only (no ongoing or hired application), with their latest rematch offer or job invitation. The tab
 * is kept in the URL (?tab=).
 */
export default function TalentPool() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_KEYS.includes(params.get("tab")) ? params.get("tab") : "waiting";
  const pool = useApplicantPool(tab);

  return (
    <>
      <PageHeader
        title="Applicant Pool"
        description="Applicants who are free to apply again. VERA invites them when HR publishes a job that fits; not-hired applicants also get an automatic rematch offer."
      />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })} className="mb-4">
        <TabsList aria-label="Applicant pool tabs">
          {TAB_KEYS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {POOL_TABS[key].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={pool.data}
        isLoading={pool.isPending}
        isError={pool.isError}
        onRetry={() => pool.refetch()}
        empty={{
          title: tab === "client" ? "Nobody was returned by a client" : "Nobody is waiting",
          description:
            tab === "client"
              ? "Applicants appear here when a client does not hire them or their training fails."
              : "Applicants appear here when an application ends before the client: not shortlisted, dropped, did not pass, not selected, or standby.",
        }}
      />
    </>
  );
}
