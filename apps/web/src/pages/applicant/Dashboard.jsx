import { BriefcaseBusiness } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { ProfileCard } from "@/features/profile/ProfileCard";

/**
 * Applicant home "My Profile" (UI_GUIDELINES §6: 60/40 — profile card | status panel, interview, notifications).
 * The status panel, interview pop-up, and notifications arrive with S11/S13.
 */
export default function Dashboard() {
  return (
    <>
      <PageHeader title="My Profile" description="Keep your details up to date. Your email is your login and cannot be changed." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <ProfileCard />
        <div className="flex flex-col gap-6">
          <EmptyState
            icon={BriefcaseBusiness}
            title="No applications yet"
            description="Find a job that fits you and apply with your resume."
            action={
              <Link to="/applicant/jobs" className={buttonVariants()}>
                Browse job vacancies
              </Link>
            }
          />
        </div>
      </div>
    </>
  );
}
