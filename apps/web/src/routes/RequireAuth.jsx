import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { FullPageSpinner } from "@/components/shared/FullPageSpinner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { ApiError } from "@/lib/apiClient";

/**
 * Signed-in users with an active VERA account only (FR-AUTH-08). Loads GET /api/me once for the guards below.
 * 401 (no account / expired session) and 403 (deactivated) sign the user out with the API's message.
 */
export function RequireAuth() {
  const { session, loading, signOut } = useAuth();
  const me = useMe();
  const location = useLocation();
  const status = me.error instanceof ApiError ? me.error.status : null;
  const refused = status === 401 || status === 403;

  useEffect(() => {
    if (!refused) return;
    toast.error(me.error.message, { id: "auth-refused", duration: Infinity });
    signOut();
  }, [refused, me.error, signOut]);

  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace state={refused ? undefined : { from: location.pathname }} />;
  if (me.isPending || refused) return <FullPageSpinner />;
  if (me.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <EmptyState
          icon={AlertCircle}
          title="VERA could not load your account"
          description={me.error.message}
          action={<Button onClick={() => me.refetch()}>Try again</Button>}
        />
      </div>
    );
  }
  return <Outlet />;
}
