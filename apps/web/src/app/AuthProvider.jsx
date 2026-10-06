import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "@/hooks/authContext";
import { supabase } from "@/lib/supabase";

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) queryClient.clear(); // never show the previous user's data
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ session, loading, signOut }), [session, loading, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
