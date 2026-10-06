import { Loader2 } from "lucide-react";

export function FullPageSpinner({ label = "Loading…" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
