import {
  CalendarDays,
  Clock3,
  Video,
  UserRound,
  Info,
  ExternalLink,
} from "lucide-react";

function UpcomingInterview() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      
      {/* Card Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={20}
            className="text-blue-600"
          />

          <h2 className="font-semibold text-[#102f53]">
            Upcoming Interview
          </h2>
        </div>

        <button
          type="button"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          View All
        </button>
      </div>

      {/* Interview Information */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[90px_1fr]">
        
        {/* Date */}
        <div className="flex h-fit flex-col items-center rounded-lg bg-blue-50 py-3 text-center">
          <span className="text-xs font-semibold text-blue-600">
            SEP
          </span>

          <span className="text-3xl font-bold text-blue-700">
            22
          </span>

          <span className="text-xs text-slate-500">
            2026
          </span>
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#102f53]">
              Initial Interview
            </h3>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              Online
            </span>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-600">
            
            <div className="flex items-center gap-2">
              <Clock3 size={16} />
              <span>10:00 AM - 11:00 AM</span>
            </div>

            <div className="flex items-center gap-2">
              <Video size={16} />
              <span>Via Google Meet</span>
            </div>

            <a
              href="#"
              className="ml-6 inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              meet.google.com/abc-defg-hij
              <ExternalLink size={13} />
            </a>

            <div className="flex items-center gap-2">
              <UserRound size={16} />
              <span>Interviewer: HR Team</span>
            </div>
          </div>
        </div>
      </div>

      {/* Information Notice */}
      <div className="mt-5 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-slate-600">
        <div className="flex gap-2">
          <Info
            size={16}
            className="mt-0.5 shrink-0 text-blue-600"
          />

          <p>
            Please be on time and prepare your valid ID. The meeting
            link will be active 10 minutes before the schedule.
          </p>
        </div>
      </div>
    </section>
  );
}

export default UpcomingInterview;