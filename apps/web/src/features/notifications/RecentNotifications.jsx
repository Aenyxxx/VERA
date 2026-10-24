import { AlertCircle, Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useNotifications } from "./api";
import { NotificationList } from "./NotificationList";

/** Dashboard card with the latest notifications (from the legacy RecentNotifications) and a link to all. */
export function RecentNotifications({ limit = 5 }) {
  const notifications = useNotifications(limit);

  return (
    <section aria-labelledby="recent-notifications-title" className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <h2 id="recent-notifications-title" className="text-card-title font-bold">
            Recent notifications
          </h2>
        </div>
        <Link
          to="/applicant/notifications"
          className="shrink-0 rounded-sm text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          View all
        </Link>
      </div>

      {notifications.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : notifications.isError ? (
        <div className="flex flex-col items-start gap-2 text-body text-muted-foreground">
          <p className="flex items-center gap-2">
            <AlertCircle className="size-4 text-error" aria-hidden="true" />
            Notifications could not be loaded.
          </p>
          <Button variant="secondary" onClick={() => notifications.refetch()}>
            Try again
          </Button>
        </div>
      ) : notifications.data.data.length === 0 ? (
        <p className="text-body text-muted-foreground">No notifications yet. Updates about your applications appear here.</p>
      ) : (
        <NotificationList items={notifications.data.data} />
      )}
    </section>
  );
}
