import { useState } from "react";
import ApplicationModal from "../Application/ApplicationModal";
import JobDetailsHeader from "./JobDetailsHeader";
import JobDescription from "./JobDescription";
import JobQualifications from "./JobQualifications";
import JobResponsibilities from "./JobResponsibilities";
import { Send } from "lucide-react";

function JobDetailsModal({ job, onClose }) {
  const [showApplication, setShowApplication] = useState(false);
  if (!job) {
    return null;
  }

  return (
    <div className="space-y-5">
      <JobDetailsHeader
        job={job}
        onClose={onClose}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <JobDescription description={job.description} />

          <button
            type="button"
            onClick={() => setShowApplication(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#102f53] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#0c2542]"
          >
            <Send size={16} className="shrink-0" />
            <span>Apply for this Job</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <JobQualifications />
          <JobResponsibilities />
        </div>
      </div>
      {showApplication && (
        <ApplicationModal
          job={job}
          onClose={() => setShowApplication(false)}
        />
      )}
    </div>
  );
}

export default JobDetailsModal;