import { useQueryClient } from "@tanstack/react-query";
import { VACANCY_STATUS } from "@vera/shared";
import { AlertCircle, Lock } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "@/features/companies/api";
import {
  useCompetencies,
  useCreateVacancy,
  useUpdateVacancy,
  useVacancy,
  useVacancyDefaults,
  vacanciesKey,
} from "@/features/vacancies/api";
import { VacancyForm } from "@/features/vacancies/VacancyForm";
import { api } from "@/lib/apiClient";

/** /admin/vacancies/new and /admin/vacancies/:id/edit */
export default function VacancyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vacancy = useVacancy(id);
  const defaults = useVacancyDefaults();
  const competencies = useCompetencies();
  const companies = useCompanies("");
  const create = useCreateVacancy();
  const update = useUpdateVacancy(id);

  const queries = [defaults, competencies, companies, ...(id ? [vacancy] : [])];
  const failed = queries.find((q) => q.isError);

  if (failed) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="The form could not be loaded"
        description={failed.error.message}
        action={<Button onClick={() => queries.forEach((q) => q.refetch())}>Try again</Button>}
      />
    );
  }
  if (queries.some((q) => q.isPending)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const status = vacancy.data?.status;
  const mode = !id ? "new" : status === VACANCY_STATUS.DRAFT ? "draft" : vacancy.data.editable.postingText ? "published" : "locked";

  if (mode === "locked") {
    return (
      <EmptyState icon={Lock} title="This vacancy can no longer be edited" description={`It is ${status}; it stays as a record.`} />
    );
  }

  async function submit(payload, { publish }) {
    const saved = id ? await update.mutateAsync(payload) : await create.mutateAsync(payload);
    const detailPath = `/admin/vacancies/${saved.vacancyId}`;
    if (publish) {
      try {
        await api.post(`/admin/vacancies/${saved.vacancyId}/publish`, {});
        toast.success("Vacancy published");
      } catch (error) {
        toast.error(`Saved as a draft, but not published: ${error.message}`, { duration: Infinity });
      }
      await queryClient.invalidateQueries({ queryKey: vacanciesKey });
    } else {
      toast.success(mode === "published" ? "Changes saved" : "Vacancy saved as a draft");
    }
    navigate(detailPath);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={id ? `Edit ${vacancy.data.jobTitle}` : "Create job vacancy"}
        description={id ? vacancy.data.companyName : "Save it as a draft first, or publish it when the weights total 100%."}
      />
      <VacancyForm
        mode={mode}
        vacancy={vacancy.data}
        defaults={defaults.data}
        rubric={competencies.data}
        companies={companies.data.data}
        onSubmit={submit}
      />
    </div>
  );
}
