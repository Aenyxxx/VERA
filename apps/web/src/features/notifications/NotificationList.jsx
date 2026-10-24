import { NOTIFICATION_TYPE as N } from "@vera/shared";
import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  CalendarClock,
  CircleSlash,
  FileSearch,
  Inbox,
  Send,
  Sparkles,
  Undo2,
  UserCheck,
  UserX,
} from "lucide-react";

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
  [N.HR_ENDORSEMENT_CONFIRMED]: { icon: UserCheck, tone: "success" }, // S15
  [N.HR_ENDORSEMENT_DECLINED]: { icon: UserX, tone: "neutral" }, // S15
  [N.ENDORSEMENT_NOTICE]: { icon: BadgeCheck, tone: "info" }, // decision 37B: information only, nothing to answer
  [N.ENDORSEMENT_REMOVED]: { icon: CircleSlash, tone: "neutral" }, // decision 37B
  [N.ENDORSED]: { icon: Send, tone: "info" }, // S16
  [N.HIRED]: { icon: BadgeCheck, tone: "success" }, // S16
  [N.NOT_HIRED]: { icon: CircleSlash, tone: "neutral" }, // S16
  [N.TRAINING_FAILED]: { icon: CircleSlash, tone: "neutral" }, // S16
  [N.REMATCH_OFFER]: { icon: Sparkles, tone: "warning" }, // S17: needs an answer
  [N.REMATCH_OFFER_EXPIRED]: { icon: CircleSlash, tone: "neutral" }, // S17
  [N.HR_REMATCH_OFFERED]: { icon: Send, tone: "info" }, // S17
  [N.HR_REMATCH_ACCEPTED]: { icon: UserCheck, tone: "success" }, // S17
  [N.HR_REMATCH_DECLINED]: { icon: UserX, tone: "neutral" }, // S17
  [N.FINAL_INTERVIEW_SCHEDULED]: { icon: CalendarClock, tone: "warning" }, // Phase 2 (decision 14)
  [N.FINAL_INTERVIEW_RESCHEDULED]: { icon: CalendarClock, tone: "info" }, // Phase 2
  [N.FOR_HIRING]: { icon: BadgeCheck, tone: "info" }, // Phase 2 (decision 15), old rows only
  [N.FOR_TRAINING]: { icon: BadgeCheck, tone: "info" }, // decision 37C
  [N.FOR_REQUIREMENTS]: { icon: BadgeCheck, tone: "info" }, // decision 37C
  [N.FOR_ORIENTATION]: { icon: BadgeCheck, tone: "info" }, // decision 37C
};

/** Notification rows: icon, title, message, time, and a dot while unread. */
export function NotificationList({ items }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const { icon: Icon, tone } = LOOK[n.type] ?? { icon: Bell, tone: "neutral" };
        return (
          <li key={n.notificationId} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11", TONE_CLASSES[tone])}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {/* Text on the left; time and unread dot on the right from sm, under the message on phones */}
            <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-body font-bold wrap-anywhere text-heading">
                  {n.title}
                  {!n.isRead && <span className="sr-only">(unread)</span>}
                </p>
                <p className="mt-0.5 text-body-sm wrap-anywhere text-text">{n.message}</p>
              </div>
              <div className="mt-1 flex shrink-0 items-center gap-3 sm:mt-0.5">
                <p className="text-caption whitespace-nowrap text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                <span
                  className={cn("size-2.5 shrink-0 rounded-full", n.isRead ? "invisible" : "bg-primary")}
                  aria-hidden="true"
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
