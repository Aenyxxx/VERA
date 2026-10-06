// Legacy mock UI (prototype). Not routed; kept as a visual reference until its slice rebuilds it. See src/legacy/README.md.

import UpcomingInterview from "@/legacy/components/dashboard/UpcomingInterview";
import RecentNotifications from "@/legacy/components/dashboard/RecentNotifications";

function ApplicantDashboard() {

  return (
    <div className="min-h-screen bg-[#f7faff]">

      <main>

        <div className="p-4 sm:p-6 lg:p-8">

          {/* Page Title */}
          <div>
            <h1 className="text-2xl font-bold text-[#102f53]">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your personal information and keep your details up to date.
            </p>
          </div>

          {/* Main Content */}
          <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">

            {/* Profile card: now features/profile/ProfileForm.jsx (S6); dashboard view/edit comes in S7 */}
            <div />

            {/* Right Side */}
            <div className="flex flex-col gap-5">
              <UpcomingInterview />
              <RecentNotifications />
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}

export default ApplicantDashboard;