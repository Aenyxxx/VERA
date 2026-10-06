import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The link may be old or mistyped."
        action={
          <Link to="/" className={buttonVariants()}>
            Go to my home page
          </Link>
        }
      />
    </div>
  );
}
