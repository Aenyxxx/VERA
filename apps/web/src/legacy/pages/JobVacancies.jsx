// Legacy mock UI (prototype). Not routed; kept as a visual reference until its slice rebuilds it. See src/legacy/README.md.
import { useState } from "react";
import JobDetailsModal from "@/legacy/components/jobVacancies/jobCards/JobDetailsModal";
import { Search, MapPin, BriefcaseBusiness } from "lucide-react";

const vacancies = [
  {
    title: "Software Engineer",
    description:
      "Develop and maintain web applications, work with cross-functional teams, and contribute to the overall product development.",
    location: "Makati City",
    type: "Full-time",
  },
  {
    title: "UI/UX Designer",
    description:
      "Create intuitive and visually appealing user experiences by designing user interfaces and improving product usability.",
    location: "Quezon City",
    type: "Full-time",
  },
  {
    title: "Marketing Specialist",
    description:
      "Plan and execute marketing campaigns, manage social media, and help grow brand awareness and customer engagement.",
    location: "Pasig City",
    type: "Full-time",
  },
  {
    title: "Data Analyst",
    description:
      "Analyze data, create reports, and provide insights to support business decisions and improve performance.",
    location: "Makati City",
    type: "Full-time",
  },
  {
    title: "Customer Support Representative",
    description:
      "Assist customers with inquiries and concerns, provide solutions, and ensure a positive customer experience.",
    location: "Manila",
    type: "Full-time",
  },
  {
    title: "HR Assistant",
    description:
      "Support recruitment, onboarding, and HR administrative tasks to help the team run smoothly.",
    location: "Pasig City",
    type: "Full-time",
  },
];

function JobVacancies() {
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <div className="min-h-screen bg-[#f7faff]">

      <main>

        <div className="p-4 sm:p-6 lg:p-8">
          {selectedJob ? (
            <JobDetailsModal
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#102f53]">
                Job Vacancies
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Explore available job opportunities and find the right fit for
                your skills and goals.
              </p>

              <div className="relative mt-6">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400"
                />

                <input
                  type="text"
                  placeholder="Search job vacancies..."
                  className="w-full rounded-lg border border-blue-100 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400"
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {vacancies.map((vacancy) => (
                  <div
                    key={vacancy.title}
                    className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#102f53]">
                        <BriefcaseBusiness size={20} />
                      </div>

                      <h2 className="text-base font-semibold text-[#102f53]">
                        {vacancy.title}
                      </h2>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {vacancy.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={15} />
                        <span>{vacancy.location}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <BriefcaseBusiness size={15} />
                        <span>{vacancy.type}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(vacancy)}
                        className="rounded-lg bg-[#102f53] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0c2542]"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default JobVacancies;