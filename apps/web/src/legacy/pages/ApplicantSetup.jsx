// Legacy mock UI (prototype). Not routed; kept as a visual reference until its slice rebuilds it. See src/legacy/README.md.
import ResumeUpload from "@/legacy/components/profile/ResumeUpload";

function ApplicantSetup() {


  return (
    <div className="min-h-screen bg-[#f7f9f8]">

      <main>

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