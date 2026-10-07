import { AlertCircle, SearchX } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob } from "@/features/jobs/api";
import { JobDetail } from "@/features/jobs/JobDetail";

export default function JobDetailPage() {
  const { vacancyId } = useParams();
  const job = useJob(vacancyId);

  if (job.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (job.isError) {
    const gone = job.error.status === 404;
    return (
      <EmptyState
        icon={gone ? SearchX : AlertCircle}
        title={gone ? "This job is no longer open" : "This job could not be loaded"}
        description={gone ? "It may have been filled or closed. Browse the other open jobs." : job.error.message}
        action={
          gone ? (
            <Link to="/applicant/jobs" className={buttonVariants()}>
              Back to Job Vacancies
            </Link>
          ) : (
            <Button onClick={() => job.refetch()}>Try again</Button>
          )
        }
      />
    );
  }

  return <JobDetail job={job.data} />;
}
