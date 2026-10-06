import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

import { useAuth } from "./useAuth";

export const meQueryOptions = (userId) => ({
  queryKey: ["me", userId],
  queryFn: () => api.get("/me"),
  staleTime: 5 * 60 * 1000,
});

/** GET /api/me → { userId, email, role, fullName, accountStatus, hasProfile } for the signed-in user. */
export function useMe() {
  const { session } = useAuth();
  return useQuery({ ...meQueryOptions(session?.user.id), enabled: Boolean(session) });
}
