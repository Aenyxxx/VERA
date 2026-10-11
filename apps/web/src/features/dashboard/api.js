import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

/** GET /api/admin/dashboard → { tiles: [{ key, label, value, … }], upcomingInterviews } (FR-ADM-01, S18). */
export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/admin/dashboard") });
}
