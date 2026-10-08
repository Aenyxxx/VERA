import { PageHeader } from "@/components/shared/PageHeader";
import { StatusPanel } from "@/features/applications/StatusPanel";
import { InterviewCard } from "@/features/interviews/InterviewCard";
import { RecentNotifications } from "@/features/notifications/RecentNotifications";
import { ProfileCard } from "@/features/profile/ProfileCard";

/**
 * Applicant home "My Profile" (UI_GUIDELINES §6: 60/40 — profile card | status panel, interview, notifications).
 * The interview card opens the confirmation pop-up while an interview awaits confirmation (S13).
 */
export default function Dashboard() {
  return (
    <>
      <PageHeader title="My Profile" description="Keep your details up to date. Your email is your login and cannot be changed." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <ProfileCard />
        <div className="flex flex-col gap-6">
          <StatusPanel />
          <InterviewCard />
          <RecentNotifications />
        </div>
      </div>
    </>
  );
}
