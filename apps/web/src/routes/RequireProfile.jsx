import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";

/** Applicant pages need a confirmed profile; without one the applicant finishes setup first (APP_FLOW §1). */
export function RequireProfile() {
  const { data: me } = useMe();
  return me.hasProfile ? <Outlet /> : <Navigate to="/applicant/setup" replace />;
}

/** The setup page is only for applicants who have not confirmed a profile yet. */
export function RequireNoProfile() {
  const { data: me } = useMe();
  return me.hasProfile ? <Navigate to="/applicant" replace /> : <Outlet />;
}
