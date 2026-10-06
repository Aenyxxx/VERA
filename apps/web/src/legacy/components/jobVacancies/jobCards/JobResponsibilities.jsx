import { ClipboardList } from "lucide-react";

function JobResponsibilities() {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
          <ClipboardList size={20} />
        </div>

        <h2 className="text-base font-semibold text-[#102f53]">
          Key Responsibilities
        </h2>
      </div>

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-500">
        <li>Develop and maintain web applications and features.</li>
        <li>Collaborate with designers, product managers, and other team members.</li>
        <li>Write clean, efficient, and maintainable code.</li>
        <li>Debug and resolve software issues.</li>
        <li>Participate in code reviews and contribute to technical improvements.</li>
      </ul>
    </section>
  );
}

export default JobResponsibilities;