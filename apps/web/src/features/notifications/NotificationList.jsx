import { NOTIFICATION_TYPE as N } from "@vera/shared";
import { Bell, CalendarCheck, CalendarClock, CircleSlash, FileSearch, Inbox, Undo2 } from "lucide-react";

import { TONE_CLASSES } from "@/components/shared/tones";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Icon and tone per type (from the legacy RecentNotifications rows); other types get a plain bell.
const LOOK = {
  [N.APPLICATION_SUBMITTED]: { icon: Inbox, tone: "info" },
  [N.SHORTLISTED]: { icon: FileSearch, tone: "info" },
  [N.SHORTLIST_DISPLACED]: { icon: Undo2, tone: "neutral" },
  [N.PRESCREEN_FAILED]: { icon: CircleSlash, tone: "error" },
  [N.BELOW_THRESHOLD]: { icon: CircleSlash, tone: "neutral" },
  [N.INTERVIEW_SCHEDULED]: { icon: CalendarClock, tone: "warning" },
  [N.INTERVIEW_RESCHEDULED]: { icon: CalendarClock, tone: "info" },
  [N.HR_INTERVIEW_CONFIRMED]: { icon: CalendarCheck, tone: "success" },
};

/** Notification rows: icon, title, message, time, and a dot while unread. */
export function NotificationList({ items }) {
  return (
    <ul className="divide-y">
      {items.map((n) => {
        const { icon: Icon, tone } = LOOK[n.type] ?? { icon: Bell, tone: "neutral" };
        return (
          <li key={n.notificationId} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[tone])}>
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-body font-semibold text-heading">
                {n.title}
                {!n.isRead && (
                  <>
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span className="sr-only">(unread)</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-body-sm text-text">{n.message}</p>
              <p className="mt-1 text-caption text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
