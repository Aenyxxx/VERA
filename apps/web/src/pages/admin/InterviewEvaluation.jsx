import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvaluation } from "@/features/evaluations/api";
import { EvaluationForm } from "@/features/evaluations/EvaluationForm";

/**
 * Interview Assessment evaluation page (APP_FLOW §4.3, S14): /admin/interviews/:vacancyId/:applicationId.
 * Rate the Competency Profile after the interview, or view a saved / reused evaluation read-only.
 */
export default function InterviewEvaluation() {
  const { vacancyId, applicationId } = useParams();
  const evaluation = useEvaluation(applicationId);
  const back = (
    <Link
      to={`/admin/interviews/${vacancyId}`}
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Interview Assessment
    </Link>
  );

  if (evaluation.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (evaluation.isError) {
    return (
      <>
        {back}
        <EmptyState
          icon={AlertCircle}
          title={evaluation.error.status === 404 ? "Application not found" : "The evaluation could not be loaded"}
          description={evaluation.error.message}
          action={evaluation.error.status !== 404 && <Button onClick={() => evaluation.refetch()}>Try again</Button>}
        />
      </>
    );
  }

  const data = evaluation.data;
  return (
    <>
      {back}
      <PageHeader
        title="Interview Assessment"
        description={`${data.application.applicantName} · ${data.vacancy.jobTitle} · ${data.vacancy.companyName}`}
      />
      <EvaluationForm data={data} />
    </>
  );
}
