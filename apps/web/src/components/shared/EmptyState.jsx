import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

/** Icon, message, and an optional primary action ("Add company", "Upload resume") (docs/UI_REDESIGN.md §3). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-12 text-center shadow-card ring-1 ring-border/80",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary-soft to-cyan/20 text-primary ring-8 ring-primary-soft/40">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-heading text-card-title font-bold text-heading">{title}</p>
        {description && <p className="mt-1 max-w-md text-body text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
