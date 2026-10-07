import { AlertCircle, BriefcaseBusiness, Search, SearchX } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobs } from "@/features/jobs/api";
import { JobCard } from "@/features/jobs/JobCard";
import { useDebounce } from "@/hooks/useDebounce";

/** Applicant Job Vacancies (FR-VAC-04): open jobs only, agency-branded, 2-column cards. */
export default function Jobs() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const jobs = useJobs(debouncedSearch);
  const rows = jobs.data?.data ?? [];

  return (
    <>
      <PageHeader title="Job Vacancies" description="Jobs offered through Confiable Manpower Solutions." />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search job title"
          placeholder="Search job title"
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {jobs.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : jobs.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Jobs could not be loaded"
          description={jobs.error.message}
          action={<Button onClick={() => jobs.refetch()}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        debouncedSearch ? (
          <EmptyState icon={SearchX} title="No matches" description="Try a different job title." />
        ) : (
          <EmptyState icon={BriefcaseBusiness} title="No open jobs right now" description="Check again soon; new jobs are posted regularly." />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((job) => (
            <JobCard key={job.vacancyId} job={job} />
          ))}
        </div>
      )}
    </>
  );
}
