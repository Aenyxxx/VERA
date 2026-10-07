import { AlertCircle, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkAllRead, useNotifications } from "@/features/notifications/api";
import { NotificationList } from "@/features/notifications/NotificationList";

const LIMIT = 50;

/** All notifications of the signed-in user (PRD FR-NOTIF-01, simplified). Used for applicants and HR/admin. */
export default function Notifications() {
  const notifications = useNotifications(LIMIT);
  const markAllRead = useMarkAllRead();
  const unread = notifications.data?.meta.unreadCount ?? 0;

  function markAll() {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read"),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`Updates about your applications, newest first (latest ${LIMIT}).`}
        actions={
          unread > 0 && (
            <Button variant="secondary" onClick={markAll} disabled={markAllRead.isPending}>
              {markAllRead.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
              Mark all as read
            </Button>
          )
        }
      />

      {notifications.isPending ? (
        <div className="flex flex-col gap-3 rounded-md border bg-card p-6" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : notifications.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Notifications could not be loaded"
          description={notifications.error.message}
          action={<Button onClick={() => notifications.refetch()}>Try again</Button>}
        />
      ) : notifications.data.data.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications yet" description="Updates about your applications appear here." />
      ) : (
        <section className="rounded-md border bg-card p-6" aria-label="Notifications">
          <NotificationList items={notifications.data.data} />
        </section>
      )}
    </>
  );
}
