import { useState } from "react";
import ApplicationHeader from "./ApplicationHeader";
import ResumeUpload from "./ResumeUpload";
import ApplicationActions from "./ApplicationActions";

function ApplicationModal({ job, onClose }) {

const [selectedCount, setSelectedCount] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-5">

        {/* Header */}
        <ApplicationHeader
          jobTitle={job.title}
          onClose={onClose}
        />

        {/* Upload Resume */}
        <ResumeUpload
          onSelectionChange={(selectedDocuments) => {
            setSelectedCount(selectedDocuments.length);
          }}
        />

        <ApplicationActions
          selectedCount={selectedCount}
          onSubmit={() => {
            console.log("Selected documents:", selectedCount);
          }}
        />
      </div>
    </div>
  );
}

export default ApplicationModal;