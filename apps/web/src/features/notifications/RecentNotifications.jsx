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
    <section aria-labelledby="recent-notifications-title" className="rounded-md border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <h2 id="recent-notifications-title" className="text-card-title font-semibold">
            Recent notifications
          </h2>
        </div>
        <Link to="/applicant/notifications" className="text-body font-semibold text-primary hover:underline">
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
