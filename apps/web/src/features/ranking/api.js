import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { vacanciesKey } from "@/features/vacancies/api";
import { api } from "@/lib/apiClient";

// Final ranking and Notify (S15, HR only). Notify refreshes the ranking and the vacancy list counts.
export const rankingKey = ["ranking"];

/** GET /api/admin/vacancies/:id/ranking → { vacancy: { notifyRemaining, canNotify, … }, ranking: [...] } */
export function useRanking(vacancyId) {
  return useQuery({
    queryKey: [...rankingKey, vacancyId],
    queryFn: () => api.get(`/admin/vacancies/${vacancyId}/ranking`),
    enabled: Boolean(vacancyId),
  });
}

/** POST /api/admin/vacancies/:id/notify { applicationIds, message } → { notified, actionDueAt, remaining } */
export function useNotify(vacancyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/admin/vacancies/${vacancyId}/notify`, body),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rankingKey });
      queryClient.invalidateQueries({ queryKey: vacanciesKey });
    },
  });
}
