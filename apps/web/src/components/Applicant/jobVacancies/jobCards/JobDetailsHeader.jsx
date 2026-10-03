import { ArrowLeft, Code2 } from "lucide-react";

function JobDetailsHeader({ job, onClose }) {
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600"
      >
        <ArrowLeft size={16} />
        <span>Back to Job Vacancies</span>
      </button>

      <div className="mt-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
          <Code2 size={24} />
        </div>

        <div>
          <h1 className="text-xl font-bold text-[#102f53]">
            {job.title}
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {job.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default JobDetailsHeader;