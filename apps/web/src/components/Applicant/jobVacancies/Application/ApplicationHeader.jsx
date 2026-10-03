import { BriefcaseBusiness, X } from "lucide-react";

function ApplicationHeader({ jobTitle, onClose }) {
  return (
    <div className="flex items-start justify-between border-b border-blue-100 pb-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <BriefcaseBusiness size={20} />
        </div>

        <div>
          <h2 className="text-sm font-bold text-[#102f53] sm:text-base">
            Apply for {jobTitle}
          </h2>

          <p className="mt-0.5 text-[10px] text-blue-400 sm:text-xs">
            Select the documents you want to submit with your application.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-blue-600 transition hover:text-blue-800"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export default ApplicationHeader;