import { POOL_REASON, POOL_TABS } from "@vera/shared";
import { Loader2, RefreshCw, Search, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountStatusDialog } from "@/features/pool/AccountStatusDialog";
import { useApplicantPool, useRunRematch } from "@/features/rematch/api";
import { OFFER_KIND_LABELS, OFFER_STATUS_LOOK, POOL_AVAILABILITY_LABELS, POOL_REASON_LABELS, rematchMessage } from "@/features/rematch/labels";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/lib/format";

/**
 * Decision 37C (moved from the Outcomes tab): Run rematch again for a not-hired entry while no offer is pending or
 * accepted and the account is active. The API refuses (409) if the applicant is no longer free.
 */
function RematchButton({ entry }) {
  const run = useRunRematch();
  const canRun =
    entry.poolReason === POOL_REASON.NOT_HIRED &&
    entry.accountStatus !== "inactive" &&
    entry.offerStatus !== "pending" &&
    entry.offerStatus !== "accepted";
  if (!canRun) return null;

  function rerun() {
    run.mutate(entry.sourceApplicationId, {
      onSuccess: (result) => toast.success(`${entry.applicantName}: ${rematchMessage(result)}`),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <Button size="sm" variant="secondary" disabled={run.isPending} aria-label={`Run rematch again for ${entry.applicantName}`} onClick={rerun}>
      {run.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
      Run rematch again
    </Button>
  );
}

function columnsFor(onAccount) {
  return [
    {
      accessorKey: "applicantName",
      header: "Applicant",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-heading">{row.original.applicantName}</span>
          <span className="text-caption text-muted-foreground">{row.original.email}</span>
        </div>
      ),
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
        return (
          <div className="flex flex-col items-start gap-1.5">
            {look ? (
              <div className="flex flex-col items-start gap-1">
                <span>
                  {offerJobTitle} <span className="text-muted-foreground">at {offerCompanyName}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{OFFER_KIND_LABELS[offerKind] ?? OFFER_KIND_LABELS.rematch_offer}</Badge>
                  <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
            <RematchButton entry={row.original} />
          </div>
        );
      },
    },
    {
      // Decision 37D: the applicant's account (the whole account, like staff accounts); HR and admin may change it.
      id: "account",
      header: "Account",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        const inactive = r.accountStatus === "inactive";
        return (
          <div className="flex min-w-44 flex-col items-start gap-1.5">
            <Badge className={TONE_CLASSES[inactive ? "neutral" : "success"]}>{inactive ? "Inactive" : "Active"}</Badge>
            {inactive && r.deactivationReason && (
              <span className="text-caption text-muted-foreground break-words">Reason: {r.deactivationReason}</span>
            )}
            <Button
              variant={inactive ? "secondary" : "destructive"}
              size="sm"
              aria-label={`${inactive ? "Activate" : "Deactivate"} ${r.applicantName}'s account`}
              onClick={() => onAccount(r)}
            >
              {inactive ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
              {inactive ? "Activate" : "Deactivate"}
            </Button>
          </div>
        );
      },
    },
  ];
}

const TAB_KEYS = Object.keys(POOL_TABS); // waiting, client

/**
 * Applicant Pool (PRD FR-POOL-01; decision 18): two tabs from @vera/shared POOL_TABS. "Waiting" = never reached the
 * client (screening up to the agency interview) plus standby; "Returned by Client" = not hired or training failed.
 * Free applicants only (no ongoing or hired application), with their latest rematch offer or job invitation. Decision
 * 37D: a search (name or email) on both tabs and an Active / Inactive control per applicant. The tab and the search are
 * kept in the URL (?tab=&q=).
 */
export default function TalentPool() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_KEYS.includes(params.get("tab")) ? params.get("tab") : "waiting";
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebounce(urlQuery.trim());
  const pool = useApplicantPool(tab, debouncedQuery);
  const [changing, setChanging] = useState(null); // decision 37D: the entry whose account is being changed

  /** Sets (or clears, for an empty value) URL params, keeping the others. */
  function update(changes) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, String(value));
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  const searching = debouncedQuery.length > 0;

  return (
    <>
      <PageHeader title="Applicant Pool" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(value) => update({ tab: value })}>
          <TabsList aria-label="Applicant pool tabs">
            {TAB_KEYS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {POOL_TABS[key].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search name or email"
            placeholder="Search name or email"
            className="pl-9"
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              update({ q: event.target.value });
            }}
          />
        </div>
      </div>
      <DataTable
        columns={columnsFor(setChanging)}
        data={pool.data}
        isLoading={pool.isPending}
        isError={pool.isError}
        onRetry={() => pool.refetch()}
        empty={
          searching
            ? { title: "No applicant matches this search" }
            : {
                title: tab === "client" ? "Nobody was returned by a client" : "Nobody is waiting",
                description:
                  tab === "client"
                    ? undefined
                    : "Applicants appear here when an application ends before the client: not shortlisted, dropped, did not pass, not selected, or standby.",
              }
        }
      />
      {changing && <AccountStatusDialog key={changing.talentPoolId} entry={changing} onClose={() => setChanging(null)} />}
    </>
  );
}
