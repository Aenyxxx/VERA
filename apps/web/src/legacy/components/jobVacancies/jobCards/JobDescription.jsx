import { FileText } from "lucide-react";

function JobDescription({ description }) {
  return (
    <section className="min-h-[260px] rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
          <FileText size={20} />
        </div>

        <h2 className="text-base font-semibold text-[#102f53]">
          Job Description
        </h2>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </section>
  );
}

export default JobDescription;