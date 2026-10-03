import { useState } from "react";

import ApplicantSidebar from "@/components/Applicant/dashboard/ApplicantSidebar";
import ApplicantHeader from "@/components/Applicant/dashboard/ApplicantHeader";
import UpcomingInterview from "@/components/Applicant/dashboard/UpcomingInterview";
import RecentNotifications from "@/components/Applicant/dashboard/RecentNotifications";
import ProfileInformation from "@/components/Applicant/dashboard/ProfileInformation";

function ApplicantDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7faff]">

      <ApplicantSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="min-h-screen lg:ml-64">

        <ApplicantHeader
          onMenuClick={() => setSidebarOpen(true)}
        />

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

            {/* Profile */}
            <div>
              <ProfileInformation />
            </div>

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