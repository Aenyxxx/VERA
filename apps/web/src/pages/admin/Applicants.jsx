import { APPLICANT_FILTERS, DASHBOARD_TILES } from "@vera/shared";
import { Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApplicants } from "@/features/applicants/api";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

const columns = [
  {
    id: "applicant",
    header: "Applicant",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold text-heading">{row.original.applicantName}</span>
        <span className="text-caption text-muted-foreground">{row.original.email}</span>
      </div>
    ),
  },
  {
    id: "application",
    header: "Current application",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.applicationId ? (
        <div className="flex flex-col">
          <span>{row.original.jobTitle}</span>
          <span className="text-caption text-muted-foreground">{row.original.companyName}</span>
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
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.lastUpdate)}</span>,
  },
];

/**
 * Applicant Management (FR-ADM-02, S18): every applicant with their current application (ongoing or hired first,
 * else the latest). Search, status filter (the dashboard tiles), and page live in the URL, so a tile link opens
 * the same filtered list. The server pages the list.
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search name or email"
            placeholder="Search name or email"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ search: event.target.value, page: null }, { replace: true });
            }}
          />
        </div>
        <select
          aria-label="Status"
          className="h-11 rounded-sm border border-input bg-card px-3 text-body sm:w-56"
          value={status}
          onChange={(event) => update({ status: event.target.value, page: null })}
        >
          <option value="">All applicants</option>
          {APPLICANT_FILTERS.map((key) => (
            <option key={key} value={key}>
              {DASHBOARD_TILES[key].label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        pageSize={PAGE_SIZE}
        isLoading={applicants.isPending}
        isError={applicants.isError}
        onRetry={() => applicants.refetch()}
        isFiltered={Boolean(debouncedSearch || status)}
        empty={{ title: "No applicants yet", description: "Applicants appear here once they sign up and confirm their profile." }}
      />

      {!applicants.isError && rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2 text-body-sm text-muted-foreground">
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
        </div>
      )}
    </>
  );
}
