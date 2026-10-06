import { VACANCY_STATUS, VACANCY_STATUS_LABELS } from "@vera/shared";
import { AlertCircle, BriefcaseBusiness, Plus, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useVacancies } from "@/features/vacancies/api";
import { VacancyCard } from "@/features/vacancies/VacancyCard";
import { useDebounce } from "@/hooks/useDebounce";

/** HR Job Vacancies (FR-VAC-05): cards with company, status, remaining slots, and stage counts; search + status filter. */
export default function Vacancies() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const vacancies = useVacancies(debouncedSearch, status);
  const rows = vacancies.data?.data ?? [];
  const filtered = Boolean(debouncedSearch || status);

  const createLink = (
    <Link to="/admin/vacancies/new" className={buttonVariants()}>
      <Plus aria-hidden="true" />
      Create job vacancy
    </Link>
  );

  return (
    <>
      <PageHeader title="Job Vacancies" description="Manpower requests from client companies." actions={createLink} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search title or company"
            placeholder="Search title or company"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Status"
          className="h-11 rounded-sm border border-input bg-card px-3 text-body sm:w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.values(VACANCY_STATUS).map((s) => (
            <option key={s} value={s}>
              {VACANCY_STATUS_LABELS[s].label}
            </option>
          ))}
        </select>
      </div>

      {vacancies.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : vacancies.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Vacancies could not be loaded"
          description={vacancies.error.message}
          action={<Button onClick={() => vacancies.refetch()}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No matches" description="Try a different search or status." />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No vacancies yet"
            description="Create a vacancy for a client company, then publish it."
            action={createLink}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((vacancy) => (
            <VacancyCard key={vacancy.vacancyId} vacancy={vacancy} />
          ))}
        </div>
      )}
    </>
  );
}
