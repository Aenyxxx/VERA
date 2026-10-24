import {
  AlertCircle,
  Briefcase,
  BriefcaseBusiness,
  CalendarCheck,
  CircleCheck,
  ExternalLink,
  FileText,
  Globe,
  Hourglass,
  Mail,
  Pencil,
  Phone,
  Send,
  Tag,
  UserRound,
} from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { useCompany } from "./api";
import { CompanyAvatar } from "./CompanyAvatar";

// FR-COMP-03 counts (definitions in PRD FR-COMP-03). Icons are decorative (design 05).
const COUNT_TILES = [
  { key: "vacancies", label: "Vacancies", icon: Briefcase },
  { key: "inAgencyInterview", label: "In agency interview", icon: CalendarCheck },
  { key: "awaitingClient", label: "Awaiting client", icon: Hourglass },
  { key: "hired", label: "Deployed", icon: CircleCheck }, // decision 37C: hired = Deployed
  { key: "endorsed", label: "Total endorsed", icon: Send },
];

// The icon sits inside the <dt> (a <dl> group may only hold dt/dd), positioned in the row's left gutter.
function Row({ icon: Icon, label, children }) {
  return (
    <div className="relative flex flex-col gap-0.5 pl-8">
      <dt className="text-label-sm text-muted-foreground">
        <Icon className="absolute top-0.5 left-0 size-5 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-body wrap-anywhere text-heading">{children || "—"}</dd>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-border/80">
      <h3 className="bg-surface-subtle px-4 py-3 font-heading text-body font-bold text-heading">{title}</h3>
      <dl className="flex flex-col gap-4 p-4">{children}</dl>
    </section>
  );
}

function Details({ company, onEdit }) {
  return (
    <>
      <section aria-label="Summary" className="grid grid-cols-2 gap-3">
        {COUNT_TILES.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-1 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80">
            <span className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="font-heading text-metric font-extrabold text-heading tabular">{company.counts[key]}</p>
            <p className="text-body-sm font-medium text-muted-foreground">
              {label}
              {key === "vacancies" && ` (${company.counts.openVacancies} open)`}
            </p>
          </div>
        ))}
      </section>

      <InfoCard title="Company information">
        <Row icon={Tag} label="Industry">
          {company.industry}
        </Row>
        <Row icon={FileText} label="Description">
          {company.description}
        </Row>
        <Row icon={Globe} label="Website">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {company.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="ml-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
            </a>
          )}
        </Row>
      </InfoCard>

      <InfoCard title="Contact person">
        <Row icon={UserRound} label="Name">
          {company.contactPersonName}
        </Row>
        <Row icon={BriefcaseBusiness} label="Position">
          {company.contactPersonPosition}
        </Row>
        <Row icon={Mail} label="Email">
          <a href={`mailto:${company.contactEmail}`} className="text-primary hover:underline">
            {company.contactEmail}
          </a>
        </Row>
        <Row icon={Phone} label="Contact number">
          {company.contactNumber && <span className="tabular">{company.contactNumber}</span>}
        </Row>
      </InfoCard>

      <Button variant="secondary" onClick={() => onEdit(company)} className="self-start">
        <Pencil aria-hidden="true" />
        Edit company
      </Button>
    </>
  );
}

/** Company detail right drawer (FR-COMP-03; DESIGN.md: 420–480px drawer). */
export function CompanyDetailSheet({ companyId, onClose, onEdit }) {
  const company = useCompany(companyId);

  return (
    <Sheet open={Boolean(companyId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-background sm:max-w-[440px]">
        <SheetHeader className="border-b border-border/70 bg-card px-4 py-4 pr-14 sm:px-6">
          <div className="flex items-center gap-3">
            {company.data && <CompanyAvatar name={company.data.companyName} className="size-12 text-body" />}
            <SheetTitle className="min-w-0 text-section-title font-bold wrap-anywhere text-heading">
              {company.data?.companyName ?? "Company details"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4 sm:p-6">
          {company.isPending && (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {company.isError && (
            <EmptyState
              icon={AlertCircle}
              title={company.error.status === 404 ? "Company not found" : "The company could not be loaded"}
              description={company.error.message}
              action={company.error.status !== 404 && <Button onClick={() => company.refetch()}>Try again</Button>}
            />
          )}
          {company.data && <Details company={company.data} onEdit={onEdit} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
