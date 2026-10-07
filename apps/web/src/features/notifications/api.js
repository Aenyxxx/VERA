import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

export const notificationsKey = ["notifications"];

/** GET /api/notifications?limit= → { data: newest first, meta: { unreadCount } } (own feed, every role). */
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: [...notificationsKey, limit],
    queryFn: () => api.list(`/notifications?limit=${limit}`),
  });
}

/** POST /api/notifications/read-all */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}
