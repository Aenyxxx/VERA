import { APPLICANT_FILTERS, DASHBOARD_TILE_ORDER, DASHBOARD_TILES } from "@vera/shared";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/features/dashboard/api";
import { formatDateTime } from "@/lib/format";

/** Where each tile leads: the applicant list filtered by the same tile, or the vacancy list. */
function tileLink(key) {
  if (key === "activeVacancies") return "/admin/vacancies";
  if (APPLICANT_FILTERS.includes(key)) return `/admin/applicants?status=${key}`;
  return "/admin/applicants";
}

const interviewColumns = [
  {
    id: "applicant",
    header: "Applicant",
    enableSorting: false,
    cell: ({ row }) => <span className="font-semibold text-heading">{row.original.applicantName}</span>,
  },
  {
    id: "job",
    header: "Job",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.jobTitle}</span>
        <span className="text-caption text-muted-foreground">{row.original.companyName}</span>
      </div>
    ),
  },
  {
    id: "scheduledAt",
    header: "Interview (Philippine time)",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.scheduledAt)}</span>,
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="interview" value={row.original.status} />,
  },
  {
    id: "interviewer",
    header: "Interviewer",
    enableSorting: false,
    cell: ({ row }) => row.original.interviewerName ?? <span className="text-muted-foreground">Not set</span>,
  },
];

/**
 * HR Dashboard (FR-ADM-01, S18): the 8 totals (definitions in @vera/shared DASHBOARD_TILES), each linking to its
 * filtered list, and the next upcoming interviews.
 */
export default function Dashboard() {
  const dashboard = useDashboard();
  const values = Object.fromEntries((dashboard.data?.tiles ?? []).map((tile) => [tile.key, tile.value]));

  return (
    <>
      <PageHeader title="Dashboard" />

      {dashboard.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="The dashboard could not be loaded"
          description={dashboard.error.message}
          action={<Button onClick={() => dashboard.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <section aria-label="Totals" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.isPending
              ? DASHBOARD_TILE_ORDER.map((key) => <Skeleton key={key} className="h-28 w-full" />)
              : DASHBOARD_TILE_ORDER.map((key) => (
                  <MetricTile key={key} label={DASHBOARD_TILES[key].label} value={values[key]} to={tileLink(key)} />
                ))}
          </section>

          <section aria-labelledby="upcoming-interviews" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="upcoming-interviews" className="text-section-title font-semibold">
                Upcoming interviews
              </h2>
              <Link to="/admin/interviews" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                All interviews
              </Link>
            </div>
            <DataTable
              columns={interviewColumns}
              data={dashboard.data?.upcomingInterviews ?? []}
              isLoading={dashboard.isPending}
              empty={{ title: "No upcoming interviews" }}
            />
          </section>
        </>
      )}
    </>
  );
}
