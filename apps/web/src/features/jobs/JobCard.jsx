import { BriefcaseBusiness, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";

/** Applicant job card (from the legacy JobVacancies card; DESIGN.md: icon, title, summary, detail affordance). */
export function JobCard({ job }) {
  return (
    <article className="flex flex-col gap-3 rounded-md border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <BriefcaseBusiness className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-card-title font-semibold">{job.jobTitle}</h2>
      </div>

      <p className="line-clamp-3 text-body text-muted-foreground">{job.summary}</p>

      <div className="flex flex-wrap gap-4 text-body-sm text-muted-foreground">
        {job.deploymentLocation && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {job.deploymentLocation}
          </span>
        )}
        {job.employmentType && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" />
            {job.employmentType}
          </span>
        )}
      </div>

      <div className="mt-auto flex justify-end pt-2">
        <Link
          to={`/applicant/jobs/${job.vacancyId}`}
          className={buttonVariants({ variant: "secondary" })}
          aria-label={`View details: ${job.jobTitle}`}
        >
          View details
        </Link>
      </div>
    </article>
  );
}
