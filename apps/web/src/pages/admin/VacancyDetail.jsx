import { EDUCATION_LEVEL_LABELS, VACANCY_STATUS } from "@vera/shared";
import { AlertCircle, ArrowLeft, BriefcaseBusiness, GraduationCap, ListChecks, Pencil, Scale, SlidersHorizontal } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAvatar } from "@/features/companies/CompanyAvatar";
import { PoolInvitationsTab } from "@/features/invitations/PoolInvitationsTab";
import { RankingTab } from "@/features/ranking/RankingTab";
import { useVacancy } from "@/features/vacancies/api";
import { VacancyStatusActions } from "@/features/vacancies/VacancyStatusActions";
import { formatDateTime } from "@/lib/format";

const GENDER_LABELS = { any: "Any", male: "Male only", female: "Female only" };

function Item({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body wrap-anywhere whitespace-pre-line text-heading">{children === null || children === "" || children === undefined ? "—" : children}</dd>
    </div>
  );
}

// Info card (design 08): soft header strip with an icon, white body.
function InfoCard({ title, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-border/80">
      <h2 className="flex items-center gap-2 bg-surface-subtle px-4 py-3 font-heading text-body font-bold text-heading sm:px-6">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {title}
      </h2>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function Panel({ title, icon, children }) {
  return (
    <InfoCard title={title} icon={icon}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>
    </InfoCard>
  );
}

function Details({ v }) {
  const age = v.minAge || v.maxAge ? `${v.minAge ?? "any"} – ${v.maxAge ?? "any"}` : "Any";
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
        <Panel title="Position" icon={BriefcaseBusiness}>
          <Item label="Company">{v.companyName}</Item>
          <Item label="Deployment location">{v.deploymentLocation}</Item>
          <Item label="Employment type">{v.employmentType}</Item>
          <Item label="Posted">{v.postedAt && formatDateTime(v.postedAt)}</Item>
          <div className="sm:col-span-2">
            <Item label="Description">{v.jobDescription}</Item>
          </div>
          <div className="sm:col-span-2">
            <Item label="Key responsibilities">{v.keyResponsibilities}</Item>
          </div>
        </Panel>
        <Panel title="Requirements (used for matching)" icon={ListChecks}>
          <Item label="Required skills">{v.requiredSkills}</Item>
          <Item label="Experience requirement">{v.experienceRequirement}</Item>
        </Panel>
        <Panel title="Qualifications (prescreen)" icon={GraduationCap}>
          <Item label="Age">{age}</Item>
          <Item label="Gender">{GENDER_LABELS[v.genderRequirement]}</Item>
          <Item label="Minimum education">{v.minEducationLevel ? EDUCATION_LEVEL_LABELS[v.minEducationLevel] : "Any"}</Item>
          <Item label="Minimum height">{v.minHeightCm ? `${v.minHeightCm} cm` : "Any"}</Item>
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Selection Settings" icon={SlidersHorizontal}>
          <Item label="Slots needed">{v.slotsNeeded}</Item>
          <Item label="Shortlist per group">{v.shortlistPerGroup}</Item>
          <Item label="Application cap">{`${v.applicationCap} (${v.applicationCount} qualified applications so far)`}</Item>
          <Item label="Endorsement count">{v.endorsementCount}</Item>
          <Item label="Matching threshold">{`${v.matchingThreshold}%`}</Item>
          <Item label="Passing score">{`${v.passingScore}%`}</Item>
        </Panel>
        <InfoCard title="Competency weights" icon={Scale}>
          <p className="mb-4 text-body-sm text-muted-foreground">
            Competency Profile: all 15 items are rated 1–5 in every interview; each section counts by its weight.
          </p>
          {v.sectionWeights.every((w) => w.weight === null) && (
            <p className="mb-3 text-body text-warning">No weights yet. Add them before publishing.</p>
          )}
          <table className="w-full text-body">
            <thead>
              <tr className="border-b text-left text-label-sm text-heading">
                <th className="py-2 font-semibold">Section and items</th>
                <th className="py-2 pl-3 text-right font-semibold">Weight</th>
              </tr>
            </thead>
            <tbody>
              {v.sectionWeights.map((w) => (
                <tr key={w.sectionCode} className="border-b align-top last:border-0">
                  <td className="py-3">
                    <p className="font-semibold text-heading">
                      {w.sectionCode}. {w.sectionName}
                    </p>
                    <p className="text-body-sm text-muted-foreground">{w.items.join(" · ")}</p>
                  </td>
                  <td className="py-3 pl-3 text-right font-semibold text-heading tabular">{w.weight === null ? "—" : `${w.weight}%`}</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 font-heading font-bold text-heading">Total</td>
                <td className="py-3 pl-3 text-right font-heading font-bold text-primary tabular">{v.weightTotal}%</td>
              </tr>
            </tbody>
          </table>
        </InfoCard>
      </div>
    </div>
  );
}

/** Vacancy detail: details, status actions, and the final ranking tab with Notify (S15). */
export default function VacancyDetail() {
  const { id } = useParams();
  const vacancy = useVacancy(id);

  if (vacancy.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (vacancy.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={vacancy.error.status === 404 ? "Vacancy not found" : "The vacancy could not be loaded"}
        description={vacancy.error.message}
        action={vacancy.error.status !== 404 && <Button onClick={() => vacancy.refetch()}>Try again</Button>}
      />
    );
  }

  const v = vacancy.data;
  const canEdit = v.editable.full || v.editable.postingText;

  return (
    <>
      <Link
        to="/admin/vacancies"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Job Vacancies
      </Link>
      <div className="mb-6 flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyAvatar name={v.companyName} className="size-14 rounded-xl text-body" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-page-title font-extrabold tracking-tight wrap-anywhere">{v.jobTitle}</h1>
              <StatusBadge kind="vacancy" value={v.status} />
            </div>
            <p className="mt-1 text-body font-semibold text-muted-foreground">{v.companyName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link to={`/admin/vacancies/${v.vacancyId}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          )}
          <VacancyStatusActions vacancy={v} />
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList aria-label="Vacancy sections">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          {v.status !== VACANCY_STATUS.DRAFT && <TabsTrigger value="invitations">Pool invitations</TabsTrigger>}
        </TabsList>
        <TabsContent value="details" className="pt-4">
          <Details v={v} />
        </TabsContent>
        <TabsContent value="ranking" className="pt-4">
          <RankingTab vacancyId={v.vacancyId} />
        </TabsContent>
        {v.status !== VACANCY_STATUS.DRAFT && (
          <TabsContent value="invitations" className="pt-4">
            <PoolInvitationsTab vacancy={v} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
