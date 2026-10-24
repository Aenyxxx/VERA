import { BadgeCheck, BriefcaseBusiness, FileDown, FileSpreadsheet, Send, Users } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { OutcomeChart, PipelineChart } from "@/features/reports/ReportCharts";
import { percent, SAMPLE_OUTCOMES, SAMPLE_PIPELINE, SAMPLE_TILES, SAMPLE_VACANCIES } from "@/features/reports/sampleData";

// Tinted tiles: same icon and tone as the Dashboard tile with the same meaning (docs/UI_REDESIGN.md §3.2).
const TILE_LOOK = {
  "Total applications": { icon: Users, tone: "info" },
  "Active vacancies": { icon: BriefcaseBusiness, tone: "success" },
  Endorsed: { icon: Send, tone: "info" },
  Hired: { icon: BadgeCheck, tone: "success" },
};

const cardClass = "min-w-0 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6";

const number = (key) => ({ row }) => <span className="tabular">{row.original[key]}</span>;

const COLUMNS = [
  { accessorKey: "vacancy", header: "Vacancy", cell: ({ row }) => <span className="font-semibold text-heading">{row.original.vacancy}</span> },
  { accessorKey: "company", header: "Company" },
  { accessorKey: "applications", header: "Applications", cell: number("applications") },
  { accessorKey: "shortlisted", header: "Shortlisted", cell: number("shortlisted") },
  { accessorKey: "endorsed", header: "Endorsed", cell: number("endorsed") },
  { accessorKey: "hired", header: "Hired", cell: ({ row }) => <span className="tabular">{row.original.hired} of {row.original.slots}</span> },
  {
    id: "fillRate",
    header: "Fill rate",
    accessorFn: (r) => percent(r.hired, r.slots),
    cell: ({ row }) => {
      const rate = percent(row.original.hired, row.original.slots);
      return (
        <div className="flex items-center gap-3">
          {/* the same value as the text beside it, drawn as a bar (blue only: no implied pass / fail) */}
          <span aria-hidden="true" className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-progress-track">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(rate, 100)}%` }} />
          </span>
          <span className="tabular">{rate}%</span>
        </div>
      );
    },
  },
];

/**
 * Recruitment Reports (decision 34, HR and admin): a PREVIEW with fixed SAMPLE numbers only. No API call, nothing
 * read from the database. Owner change Oct 20: no banner; Export PDF / Export Excel are enabled but do nothing. The
 * presenter says aloud that the page shows sample data (DEFENSE_DEMO_CHECKLIST Extra F); real reports come later.
 */
export default function Reports() {
  return (
    <>
      <PageHeader
        title="Recruitment Reports"
        actions={
          <>
            {/* Owner change Oct 20: enabled, but inactive (no request, navigation, download, or toast). */}
            <Button type="button" variant="secondary">
              <FileDown aria-hidden="true" />
              Export PDF
            </Button>
            <Button type="button" variant="secondary">
              <FileSpreadsheet aria-hidden="true" />
              Export Excel
            </Button>
          </>
        }
      />

      <section aria-label="Totals (sample)" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SAMPLE_TILES.map((t) => (
          <MetricTile key={t.label} label={t.label} value={t.value} icon={TILE_LOOK[t.label]?.icon} tone={TILE_LOOK[t.label]?.tone} />
        ))}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <section className={cardClass}>
          <PipelineChart stages={SAMPLE_PIPELINE} />
        </section>
        <section className={cardClass}>
          <OutcomeChart outcomes={SAMPLE_OUTCOMES} />
        </section>
      </div>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-section-title font-bold text-heading">Vacancy performance</h2>
        <DataTable
          columns={COLUMNS}
          data={SAMPLE_VACANCIES}
          empty={{ title: "No vacancies", description: "Vacancy results appear here." }}
        />
      </section>
    </>
  );
}
