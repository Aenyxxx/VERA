import { EDUCATION_LEVEL_LABELS } from "@vera/shared";
import { AlertCircle, ArrowLeft, ListOrdered, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVacancy } from "@/features/vacancies/api";
import { VacancyStatusActions } from "@/features/vacancies/VacancyStatusActions";
import { formatDateTime } from "@/lib/format";

const GENDER_LABELS = { any: "Any", male: "Male only", female: "Female only" };

function Item({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body whitespace-pre-line text-heading">{children === null || children === "" || children === undefined ? "—" : children}</dd>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-md border bg-card p-6">
      <h2 className="mb-4 text-card-title font-semibold">{title}</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Details({ v }) {
  const age = v.minAge || v.maxAge ? `${v.minAge ?? "any"} – ${v.maxAge ?? "any"}` : "Any";
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Position">
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
      <Panel title="Requirements (used for matching)">
        <Item label="Required skills">{v.requiredSkills}</Item>
        <Item label="Experience requirement">{v.experienceRequirement}</Item>
        <Item label="Minimum years of experience">{v.minYearsExperience}</Item>
      </Panel>
      <Panel title="Qualifications (prescreen)">
        <Item label="Age">{age}</Item>
        <Item label="Gender">{GENDER_LABELS[v.genderRequirement]}</Item>
        <Item label="Minimum education">{v.minEducationLevel ? EDUCATION_LEVEL_LABELS[v.minEducationLevel] : "Any"}</Item>
        <Item label="Minimum height">{v.minHeightCm ? `${v.minHeightCm} cm` : "Any"}</Item>
      </Panel>
      <Panel title="Pipeline settings">
        <Item label="Slots needed">{v.slotsNeeded}</Item>
        <Item label="Shortlist per group">{v.shortlistPerGroup}</Item>
        <Item label="Application cap">{`${v.applicationCap} (${v.applicationCount} qualified applications so far)`}</Item>
        <Item label="Endorsement count">{v.endorsementCount}</Item>
        <Item label="Matching threshold">{`${v.matchingThreshold}%`}</Item>
        <Item label="Passing score">{`${v.passingScore}%`}</Item>
      </Panel>
      <section className="rounded-md border bg-card p-6">
        <h2 className="mb-1 text-card-title font-semibold">Competency weights</h2>
        <p className="mb-4 text-body-sm text-muted-foreground">
          Competency Profile: all 15 items are rated 1–5 in every interview; each section counts by its weight.
        </p>
        {v.sectionWeights.every((w) => w.weight === null) && (
          <p className="mb-3 text-body text-warning">No weights yet. Add them before publishing.</p>
        )}
        <table className="w-full text-body">
          <thead>
            <tr className="border-b text-left text-label-sm text-muted-foreground">
              <th className="py-2 font-semibold">Section and items</th>
              <th className="py-2 text-right font-semibold">Weight</th>
            </tr>
          </thead>
          <tbody>
            {v.sectionWeights.map((w) => (
              <tr key={w.sectionCode} className="border-b align-top last:border-0">
                <td className="py-2">
                  <p className="font-semibold text-heading">
                    {w.sectionCode}. {w.sectionName}
                  </p>
                  <p className="text-body-sm text-muted-foreground">{w.items.join(" · ")}</p>
                </td>
                <td className="py-2 text-right tabular">{w.weight === null ? "—" : `${w.weight}%`}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right font-semibold tabular">{v.weightTotal}%</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** Vacancy detail shell: details, status actions, and the ranking tab (filled in S15). */
export default function VacancyDetail() {
  const { id } = useParams();
  const vacancy = useVacancy(id);

  if (vacancy.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
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
      <Link to="/admin/vacancies" className="mb-3 inline-flex items-center gap-1 text-body text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Job Vacancies
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-page-title font-bold">{v.jobTitle}</h1>
            <StatusBadge kind="vacancy" value={v.status} />
          </div>
          <p className="mt-1 text-body text-muted-foreground">{v.companyName}</p>
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
        </TabsList>
        <TabsContent value="details" className="pt-4">
          <Details v={v} />
        </TabsContent>
        <TabsContent value="ranking" className="pt-4">
          <EmptyState
            icon={ListOrdered}
            title="No ranking yet"
            description="The final ranking appears here once applicants are interviewed and evaluated."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
