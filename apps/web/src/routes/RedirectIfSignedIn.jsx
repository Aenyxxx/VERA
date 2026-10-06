import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageSpinner } from "@/components/shared/FullPageSpinner";
import { useAuth } from "@/hooks/useAuth";

/** Public auth pages. Once signed in, continue to the page the user asked for, or "/" (role redirect). */
export function RedirectIfSignedIn() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to={location.state?.from ?? "/"} replace />;
  return <Outlet />;
}
