import { EDUCATION_LEVEL_LABELS } from "@vera/shared";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  Send,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useBlockingApplication, useMyApplications } from "@/features/applications/api";
import { ApplyDialog } from "@/features/applications/ApplyDialog";
import { OngoingApplicationNotice } from "@/features/applications/OngoingApplicationNotice";
import { formatDateTime } from "@/lib/format";

import { BulletList, JobSection } from "./JobSection";
import { linesOf } from "./text";

/**
 * What an applicant may read about a job's requirements.
 * Age range and gender requirement are deliberately NOT shown: RA 10911 (Anti-Age Discrimination in Employment
 * Act) prohibits job notices that state age preferences, and gender preferences raise similar concerns. They are
 * still enforced at apply time (prescreen, S11), and the prescreen_failed notification names the unmet condition.
 */
function qualificationsOf(job) {
  const items = linesOf(job.requiredSkills);
  // No minimum years (decision 11): a job without experience text has no experience criterion.
  if (linesOf(job.experienceRequirement).length === 0) items.push("No work experience required");
  if (job.minEducationLevel) items.push(`Education: ${EDUCATION_LEVEL_LABELS[job.minEducationLevel]} or higher`);
  if (job.minHeightCm) items.push(`Height: at least ${job.minHeightCm} cm`);
  return items;
}

/**
 * Apply button → ApplyDialog (FR-APP-02). One application per job, ever (FR-APP-06): once applied, the button
 * is replaced by the current stage (TC-34). With an ongoing (or hired) application elsewhere, Apply is disabled
 * and the notice below the header explains why (BR-17). While the applicant's applications load, the button waits.
 */
function ApplyAction({ job, blocking }) {
  const applications = useMyApplications();
  const [dialogKey, setDialogKey] = useState(0);
  const [open, setOpen] = useState(false);
  const existing = applications.data?.find((a) => a.vacancyId === job.vacancyId);

  if (existing) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Button disabled className="w-full sm:w-auto">
          <CheckCircle2 aria-hidden="true" />
          Applied
        </Button>
        <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
          Status: <StatusBadge kind="application" value={existing.status} audience="applicant" />
        </p>
      </div>
    );
  }

  return (
    <>
      <Button
        className="w-full sm:w-auto sm:min-w-36"
        disabled={applications.isPending || Boolean(blocking)}
        aria-describedby={blocking ? "ongoing-application" : undefined}
        onClick={() => {
          setDialogKey((key) => key + 1);
          setOpen(true);
        }}
      >
        <Send aria-hidden="true" />
        Apply
      </Button>
      <ApplyDialog key={dialogKey} open={open} onOpenChange={setOpen} job={job} />
    </>
  );
}

/** Job detail for applicants (from the legacy JobDetailsHeader + JobDetailsModal; agency-branded, no company). */
export function JobDetail({ job }) {
  const [experienceTitle, ...duties] = linesOf(job.experienceRequirement);
  const { blocking } = useBlockingApplication();
  const blockedElsewhere = blocking && blocking.vacancyId !== job.vacancyId ? blocking : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/applicant/jobs"
        className="-mb-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Job Vacancies
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/15 sm:size-16"
            aria-hidden="true"
          >
            <BriefcaseBusiness className="size-7 sm:size-8" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-page-title font-extrabold tracking-tight break-words text-heading">{job.jobTitle}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-body-sm text-text">
              {job.deploymentLocation && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 ring-1 ring-border">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {job.deploymentLocation}
                </span>
              )}
              {job.employmentType && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 ring-1 ring-border">
                  <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {job.employmentType}
                </span>
              )}
              {job.postedAt && (
                <span className="inline-flex items-center px-1 py-1 text-muted-foreground">Posted {formatDateTime(job.postedAt)}</span>
              )}
            </div>
          </div>
        </div>

        <ApplyAction job={job} blocking={blockedElsewhere} />
      </header>

      {blockedElsewhere && (
        <div id="ongoing-application">
          <OngoingApplicationNotice blocking={blockedElsewhere} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <JobSection icon={FileText} title="Job description">
          <p className="whitespace-pre-line text-body text-text">{job.jobDescription}</p>
          {experienceTitle && (
            <div className="mt-4">
              <h3 className="text-body font-semibold text-heading">Experience: {experienceTitle}</h3>
              {duties.length > 0 && (
                <div className="mt-2">
                  <BulletList items={duties} />
                </div>
              )}
            </div>
          )}
        </JobSection>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <JobSection icon={GraduationCap} title="Qualifications">
            <BulletList items={qualificationsOf(job)} />
          </JobSection>
          <JobSection icon={ClipboardList} title="Key responsibilities">
            <BulletList items={linesOf(job.keyResponsibilities)} />
          </JobSection>
        </div>
      </div>
    </div>
  );
}
