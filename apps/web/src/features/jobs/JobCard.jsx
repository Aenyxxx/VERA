import { BriefcaseBusiness, ChevronRight, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Applicant job card (from the legacy JobVacancies card; design 34: icon tile, title, summary, detail affordance).
 * The "View details" link stretches over the whole card, so the card is one click target.
 */
export function JobCard({ job }) {
  return (
    <article className="group/card relative flex gap-4 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-raised has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/40 sm:p-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
        <BriefcaseBusiness className="size-6" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="font-heading text-card-title font-bold break-words text-heading">{job.jobTitle}</h2>

        <p className="line-clamp-3 text-body text-muted-foreground">{job.summary}</p>

        {(job.deploymentLocation || job.employmentType) && (
          <div className="flex flex-wrap gap-2 pt-1 text-body-sm text-text">
            {job.deploymentLocation && (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-surface-blue px-2 py-1">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {job.deploymentLocation}
              </span>
            )}
            {job.employmentType && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-blue px-2 py-1">
                <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {job.employmentType}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex justify-end pt-2">
          <Link
            to={`/applicant/jobs/${job.vacancyId}`}
            className="inline-flex min-h-11 items-center gap-1 text-body font-semibold text-primary outline-none after:absolute after:inset-0 after:rounded-xl hover:underline"
            aria-label={`View details: ${job.jobTitle}`}
          >
            View details
            <ChevronRight
              className="size-5 transition-transform duration-150 group-hover/card:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}
