import { AlertCircle, ExternalLink, Mail, Pencil, Phone } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { useCompany } from "./api";

// FR-COMP-03 counts (definitions in PRD FR-COMP-03).
const COUNT_TILES = [
  { key: "vacancies", label: "Vacancies" },
  { key: "inAgencyInterview", label: "In agency interview" },
  { key: "awaitingClient", label: "Awaiting client" },
  { key: "hired", label: "Hired" },
  { key: "endorsed", label: "Total endorsed" },
];

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body text-heading">{children || "—"}</dd>
    </div>
  );
}

function Details({ company, onEdit }) {
  return (
    <div className="flex flex-col gap-6 px-6 pb-6">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3">
        {COUNT_TILES.map(({ key, label }) => (
          <div key={key} className="rounded-md border p-3">
            <p className="text-metric font-bold text-heading tabular">{company.counts[key]}</p>
            <p className="text-body-sm text-muted-foreground">
              {label}
              {key === "vacancies" && ` (${company.counts.openVacancies} open)`}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-card-title font-semibold">Company information</h3>
        <dl className="flex flex-col gap-3">
          <Row label="Industry">{company.industry}</Row>
          <Row label="Description">{company.description}</Row>
          <Row label="Website">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {company.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </Row>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-card-title font-semibold">Contact person</h3>
        <dl className="flex flex-col gap-3">
          <Row label="Name">{company.contactPersonName}</Row>
          <Row label="Position">{company.contactPersonPosition}</Row>
          <Row label="Email">
            <a href={`mailto:${company.contactEmail}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mail className="size-3.5" aria-hidden="true" />
              {company.contactEmail}
            </a>
          </Row>
          <Row label="Contact number">
            {company.contactNumber && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" aria-hidden="true" />
                {company.contactNumber}
              </span>
            )}
          </Row>
        </dl>
      </section>

      <Button variant="secondary" onClick={() => onEdit(company)} className="self-start">
        <Pencil aria-hidden="true" />
        Edit company
      </Button>
    </div>
  );
}

/** Company detail right drawer (FR-COMP-03; DESIGN.md: 420–480px drawer). */
export function CompanyDetailSheet({ companyId, onClose, onEdit }) {
  const company = useCompany(companyId);

  return (
    <Sheet open={Boolean(companyId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-section-title font-bold text-heading">
            {company.data?.companyName ?? "Company details"}
          </SheetTitle>
          <SheetDescription>Company details and recruitment summary</SheetDescription>
        </SheetHeader>

        {company.isPending && (
          <div className="flex flex-col gap-3 px-6" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {company.isError && (
          <div className="px-6">
            <EmptyState
              icon={AlertCircle}
              title={company.error.status === 404 ? "Company not found" : "The company could not be loaded"}
              description={company.error.message}
              action={company.error.status !== 404 && <Button onClick={() => company.refetch()}>Try again</Button>}
            />
          </div>
        )}
        {company.data && <Details company={company.data} onEdit={onEdit} />}
      </SheetContent>
    </Sheet>
  );
}
