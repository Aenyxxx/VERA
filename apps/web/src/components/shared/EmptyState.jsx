import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

/** Icon, message, and an optional primary action ("Add company", "Upload resume"). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-card-title font-semibold text-heading">{title}</p>
        {description && <p className="mt-1 max-w-md text-body text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
