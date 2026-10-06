import { useState } from "react";
import ApplicantSidebar from "@/components/Applicant/dashboard/ApplicantSidebar";
import ApplicantHeader from "@/components/Applicant/dashboard/ApplicantHeader";
import ResumeUpload from "@/components/Applicant/profile/ResumeUpload";

function ApplicantSetup() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userAccount = JSON.parse(
    localStorage.getItem("user_account") || "{}"
  );

  const displayName = userAccount?.email?.split("@")[0] || "Applicant";

  return (
    <div className="min-h-screen bg-[#f7f9f8]">
      <ApplicantSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="min-h-screen lg:ml-64">
        <ApplicantHeader
          onMenuClick={() => setSidebarOpen(true)}
          displayName={displayName}
        />

        <div className="p-6">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="text-center">
                <h1 className="text-2xl font-semibold text-[#1e3a5f]">
                  Create Your Profile
                </h1>

                <p className="mt-2 text-sm text-gray-500">
                  Upload your resume to get started with your VERA profile.
                </p>
              </div>

              <ResumeUpload />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ApplicantSetup;