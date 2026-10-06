import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { homePathFor } from "@/lib/auth";

/** Inside RequireAuth. A user on another role's page is sent to their own home page. */
export function RequireRole({ roles }) {
  const { data: me } = useMe();
  if (!roles.includes(me.role)) return <Navigate to={homePathFor(me)} replace />;
  return <Outlet />;
}
