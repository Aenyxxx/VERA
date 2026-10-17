import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// User Management (decision 19, admin only).
export const usersKey = ["users"];

/** GET /api/admin/users → staff accounts with isSelf. */
export function useStaffUsers() {
  return useQuery({ queryKey: usersKey, queryFn: () => api.get("/admin/users") });
}

/** POST /api/admin/users { email, fullName, temporaryPassword } → the new HR account. */
export function useCreateHrAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/admin/users", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

/** PATCH /api/admin/users/:id/status { accountStatus } → { userId, accountStatus, signInBlocked }. */
export function useSetAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountStatus }) => api.patch(`/admin/users/${userId}/status`, { accountStatus }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}
