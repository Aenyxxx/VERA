import { GraduationCap } from "lucide-react";

function JobQualifications() {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
          <GraduationCap size={20} />
        </div>

        <h2 className="text-base font-semibold text-[#102f53]">
          Qualifications
        </h2>
      </div>

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-500">
        <li>Bachelor's degree in Computer Science or related field</li>
        <li>Knowledge of modern web development technologies</li>
        <li>Strong problem-solving and communication skills</li>
        <li>Ability to work effectively with a team</li>
      </ul>
    </section>
  );
}

export default JobQualifications;