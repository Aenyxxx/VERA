import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// Pool matching on publish and job invitations, HR side (Phase 3, decision 17). The run happens in the background, so
// the tab polls while it is running.
export const invitationsKey = (vacancyId) => ["vacancies", vacancyId, "invitations"];

/** GET /api/admin/vacancies/:id/invitations → { running, poolMatchedAt, summary, invitations } (polls every 3 s while running). */
export function useVacancyInvitations(vacancyId) {
  return useQuery({
    queryKey: invitationsKey(vacancyId),
    queryFn: () => api.get(`/admin/vacancies/${vacancyId}/invitations`),
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  });
}

/** POST /api/admin/vacancies/:id/pool-matching → { status: "started" } ("Run pool matching again"). */
export function useRunPoolMatching(vacancyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/admin/vacancies/${vacancyId}/pool-matching`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: invitationsKey(vacancyId) }),
  });
}
