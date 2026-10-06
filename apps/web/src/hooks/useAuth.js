import { useContext } from "react";

import { AuthContext } from "./authContext";

/** Current Supabase session: { session, loading, signOut }. */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
