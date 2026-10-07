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
import { useMyApplications } from "@/features/applications/api";
import { ApplyDialog } from "@/features/applications/ApplyDialog";
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
  items.push(
    job.minYearsExperience > 0
      ? `At least ${job.minYearsExperience} ${job.minYearsExperience === 1 ? "year" : "years"} of experience`
      : "No work experience required",
  );
  if (job.minEducationLevel) items.push(`Education: ${EDUCATION_LEVEL_LABELS[job.minEducationLevel]} or higher`);
  if (job.minHeightCm) items.push(`Height: at least ${job.minHeightCm} cm`);
  return items;
}

/**
 * Apply button → ApplyDialog (FR-APP-02). One application per job, ever (FR-APP-06): once applied, the button
 * is replaced by the current stage (TC-34). While the applicant's applications load, the button waits.
 */
function ApplyAction({ job }) {
  const applications = useMyApplications();
  const [dialogKey, setDialogKey] = useState(0);
  const [open, setOpen] = useState(false);
  const existing = applications.data?.find((a) => a.vacancyId === job.vacancyId);

  if (existing) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button disabled>
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
        disabled={applications.isPending}
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

  return (
    <div className="flex flex-col gap-6">
      <Link to="/applicant/jobs" className="inline-flex items-center gap-1 self-start text-body text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Job Vacancies
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <BriefcaseBusiness className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-page-title font-bold">{job.jobTitle}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-body text-muted-foreground">
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
              {job.postedAt && <span>Posted {formatDateTime(job.postedAt)}</span>}
            </div>
          </div>
        </div>

        <ApplyAction job={job} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
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

        <div className="flex flex-col gap-6">
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
