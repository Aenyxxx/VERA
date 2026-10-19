import { FileDown, FileSpreadsheet, Info } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { OutcomeChart, PipelineChart } from "@/features/reports/ReportCharts";
import { percent, SAMPLE_OUTCOMES, SAMPLE_PIPELINE, SAMPLE_TILES, SAMPLE_VACANCIES } from "@/features/reports/sampleData";

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
    cell: ({ row }) => <span className="tabular">{percent(row.original.hired, row.original.slots)}%</span>,
  },
];

/**
 * Recruitment Reports (decision 34, HR and admin): a PREVIEW with fixed SAMPLE numbers only. No API call, nothing
 * read from the database, exports disabled. The banner says so; the real reports come after the defense.
 */
export default function Reports() {
  return (
    <>
      <PageHeader
        title="Recruitment Reports"
        description="Pipeline, hiring outcomes, and vacancy performance."
        actions={
          <>
            <Button variant="secondary" disabled aria-describedby="reports-export-soon">
              <FileDown aria-hidden="true" />
              Export PDF
            </Button>
            <Button variant="secondary" disabled aria-describedby="reports-export-soon">
              <FileSpreadsheet aria-hidden="true" />
              Export Excel
            </Button>
            <span id="reports-export-soon" className="text-label-sm text-muted-foreground">
              Coming soon
            </span>
          </>
        }
      />

      <div role="note" className="mb-6 flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft p-4 text-body text-text">
        <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="font-semibold text-heading">Preview: sample data</p>
          <p>These numbers are examples to show the layout. They are not VERA&apos;s records and change nothing.</p>
        </div>
      </div>

      <section aria-label="Totals (sample)" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SAMPLE_TILES.map((t) => (
          <MetricTile key={t.label} label={t.label} value={t.value} />
        ))}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-md border bg-card p-4 sm:p-6">
          <PipelineChart stages={SAMPLE_PIPELINE} />
        </section>
        <section className="rounded-md border bg-card p-4 sm:p-6">
          <OutcomeChart outcomes={SAMPLE_OUTCOMES} />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-bold">Vacancy performance</h2>
        <DataTable
          columns={COLUMNS}
          data={SAMPLE_VACANCIES}
          empty={{ title: "No vacancies", description: "Vacancy results appear here." }}
        />
      </section>
    </>
  );
}
