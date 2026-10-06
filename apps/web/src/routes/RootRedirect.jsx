import { Navigate } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { homePathFor } from "@/lib/auth";

/** "/" → the signed-in user's home page by role (FR-AUTH-01). Inside RequireAuth. */
export function RootRedirect() {
  const { data: me } = useMe();
  return <Navigate to={homePathFor(me)} replace />;
}
