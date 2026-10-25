import { APPLICANT_FILTERS } from "@vera/shared";
import { Search, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { SELECT_CLASS } from "@/components/shared/fieldClasses";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountDialog } from "@/features/applicants/AccountDialog";
import { useApplicants } from "@/features/applicants/api";
import { tileLabel } from "@/features/dashboard/tileLabels";
import { useDebounce } from "@/hooks/useDebounce";
import { initialsOf } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

function columnsFor(onAccount) {
  return [
  {
    id: "applicant",
    header: "Applicant",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        {/* decorative initials disc (design 12); the name stays the accessible text */}
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nav text-label-sm font-semibold text-white"
        >
          {initialsOf(row.original.applicantName)}
        </span>
        <div className="flex min-w-40 flex-col">
          <span className="font-semibold text-heading">{row.original.applicantName}</span>
          <span className="text-body-sm break-all text-muted-foreground">{row.original.email}</span>
        </div>
      </div>
    ),
  },
  {
    id: "application",
    header: "Current application",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.applicationId ? (
        <div className="flex min-w-36 flex-col">
          <span className="text-heading">{row.original.jobTitle}</span>
          <span className="text-body-sm text-muted-foreground">{row.original.companyName}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">No applications yet</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (row.original.status ? <StatusBadge kind="application" value={row.original.status} /> : null),
  },
  {
    id: "lastUpdate",
    header: "Last update",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatDateTime(row.original.lastUpdate)}</span>,
  },
  {
    // Decision 39-4 (moved from the Applicant Pool, decision 37D): the applicant's whole account; HR and admin.
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
            <span className="text-body-sm break-words text-muted-foreground">Reason: {r.deactivationReason}</span>
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

/**
 * Applicant Management (FR-ADM-02, S18): every applicant with their current application (ongoing or hired first,
 * else the latest). Search, status filter (the dashboard tiles), and page live in the URL, so a tile link opens
 * the same filtered list. The server pages the list. Decision 39-4: an Account column (Active / Inactive, HR's reason,
 * Deactivate / Activate for every applicant; HR and admin).
 */
export default function Applicants() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const status = APPLICANT_FILTERS.includes(params.get("status")) ? params.get("status") : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1);

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(urlSearch.trim());
  const applicants = useApplicants({ search: debouncedSearch, status, page, pageSize: PAGE_SIZE });
  const rows = applicants.data?.data ?? [];
  const meta = applicants.data?.meta;
  const [changing, setChanging] = useState(null); // decision 39-4: the row whose account is being changed

  /** Sets (or clears, for an empty value) URL params; a new search or filter starts again at page 1. */
  function update(changes, { replace = false } = {}) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, String(value));
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );
  }

  const first = meta ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const last = meta ? first + rows.length - 1 : 0;
  const paging = applicants.isPlaceholderData;

  return (
    <>
      <PageHeader title="Applicant Management" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-primary" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search name or email"
            placeholder="Search name or email"
            className="pl-11"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ search: event.target.value, page: null }, { replace: true });
            }}
          />
        </div>
        <select
          aria-label="Status"
          className={`${SELECT_CLASS} sm:w-56`}
          value={status}
          onChange={(event) => update({ status: event.target.value, page: null })}
        >
          <option value="">All applicants</option>
          {APPLICANT_FILTERS.map((key) => (
            <option key={key} value={key}>
              {tileLabel(key)}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columnsFor(setChanging)}
        data={rows}
        pageSize={PAGE_SIZE}
        isLoading={applicants.isPending}
        isError={applicants.isError}
        onRetry={() => applicants.refetch()}
        isFiltered={Boolean(debouncedSearch || status)}
        empty={{ title: "No applicants yet", description: "Applicants appear here once they sign up and confirm their profile." }}
        footer={
          rows.length > 0 && (
            <>
              <span className="tabular">
                Showing {first}–{last} of {meta.total}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || paging} onClick={() => update({ page: page - 1 })}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={last >= meta.total || paging} onClick={() => update({ page: page + 1 })}>
                  Next
                </Button>
              </div>
            </>
          )
        }
      />
      {changing && <AccountDialog key={changing.applicantId} row={changing} onClose={() => setChanging(null)} />}
    </>
  );
}
