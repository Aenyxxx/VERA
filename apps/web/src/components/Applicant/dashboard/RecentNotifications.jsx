import {
  Bell,
  CheckCircle2,
  CalendarDays,
  FileCheck2,
} from "lucide-react";

function RecentNotifications() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell
            size={20}
            className="text-blue-600"
          />

          <h2 className="font-semibold text-[#102f53]">
            Recent Notifications
          </h2>
        </div>

        <button
          type="button"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          View All
        </button>
      </div>

      {/* Notifications */}
      <div className="divide-y divide-slate-100">
        
        {/* Notification 1 */}
        <div className="flex gap-3 py-4 first:pt-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2
              size={18}
              className="text-green-500"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Your application has been reviewed
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Your application is now moving to the interview stage.
            </p>

            <p className="mt-2 text-[11px] text-slate-400">
              2 days ago
            </p>
          </div>
        </div>

        {/* Notification 2 */}
        <div className="flex gap-3 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <CalendarDays
              size={18}
              className="text-blue-600"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Interview scheduled
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Your initial interview has been scheduled for September 22.
            </p>

            <p className="mt-2 text-[11px] text-slate-400">
              3 days ago
            </p>
          </div>
        </div>

        {/* Notification 3 */}
        <div className="flex gap-3 py-4 last:pb-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50">
            <FileCheck2
              size={18}
              className="text-purple-600"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Documents verified
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Your submitted documents have been successfully verified.
            </p>

            <p className="mt-2 text-[11px] text-slate-400">
              5 days ago
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}

export default RecentNotifications;