import { DASHBOARD_TILE_ORDER } from "@vera/shared";
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  FileSearch,
  Handshake,
  Users,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/features/dashboard/api";
import { tileLabel } from "@/features/dashboard/tileLabels";
import { formatDateTime } from "@/lib/format";

/**
 * Decision 40-1: the Waiting pool tile is not shown (7 tiles). The API still sends all 8 (@vera/shared
 * DASHBOARD_TILE_ORDER, check-s18), and Applicant Management keeps its Waiting pool filter.
 */
const SHOWN_TILES = DASHBOARD_TILE_ORDER.filter((key) => key !== "waitingPool");

/**
 * Where each tile leads (owner, Oct 24): the page that works on those applicants, or Applicant Management filtered
 * by the same tile (Deployed) where no page of its own exists.
 */
const TILE_LINKS = {
  applicants: "/admin/applicants",
  forScreening: "/admin/screening",
  forInterview: "/admin/interviews",
  forEndorsement: "/admin/endorsements",
  hired: "/admin/applicants?status=hired",
  applicantPool: "/admin/talent-pool",
  activeVacancies: "/admin/vacancies",
};

/**
 * Look of each tile (visual only): icon and tint. Tints follow the badge tones (docs/UI_REDESIGN.md §2.2, §3.3):
 * interview purple, Deployed (hired) and active vacancies green, endorsement blue like its status; screening teal (the
 * resume matching colour), the applicant pool neutral.
 */
const TILE_LOOK = {
  applicants: { icon: Users, tone: "info" },
  forScreening: { icon: FileSearch, tone: "resume" },
  forInterview: { icon: CalendarCheck, tone: "interview" },
  forEndorsement: { icon: Handshake, tone: "info" },
  hired: { icon: BadgeCheck, tone: "success" },
  applicantPool: { icon: UsersRound, tone: "neutral" },
  activeVacancies: { icon: BriefcaseBusiness, tone: "success" },
};

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
        <span className="text-heading">{row.original.jobTitle}</span>
        <span className="text-caption text-muted-foreground">{row.original.companyName}</span>
      </div>
    ),
  },
  {
    id: "scheduledAt",
    header: "Interview (Philippine time)",
    enableSorting: false,
    cell: ({ row }) => <span className="whitespace-nowrap tabular">{formatDateTime(row.original.scheduledAt)}</span>,
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
 * HR Dashboard (FR-ADM-01, S18): 7 totals (definitions in @vera/shared DASHBOARD_TILES; Waiting pool not shown,
 * decision 40-1), each linking to its page (TILE_LINKS), and the next upcoming interviews.
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
              ? SHOWN_TILES.map((key) => <Skeleton key={key} className="h-28 w-full rounded-xl" />)
              : SHOWN_TILES.map((key) => (
                  <MetricTile
                    key={key}
                    label={tileLabel(key)}
                    value={values[key]}
                    to={TILE_LINKS[key]}
                    icon={TILE_LOOK[key].icon}
                    tone={TILE_LOOK[key].tone}
                  />
                ))}
          </section>

          <section
            aria-labelledby="upcoming-interviews"
            className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="upcoming-interviews" className="font-heading text-section-title font-bold text-heading">
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
              bare
            />
          </section>
        </>
      )}
    </>
  );
}
