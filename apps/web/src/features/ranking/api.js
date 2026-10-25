import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { endorsementsKey } from "@/features/endorsements/api";
import { vacanciesKey } from "@/features/vacancies/api";
import { api } from "@/lib/apiClient";

// Final ranking and Notify (S15, HR only). Decision 39-3: Notify also creates the endorsement, so it refreshes the
// ranking, the vacancy list counts, Endorsement Management and the interviews.
export const rankingKey = ["ranking"];

/** GET /api/admin/vacancies/:id/ranking → { vacancy: { notifyRemaining, canNotify, … }, ranking: [...] } */
export function useRanking(vacancyId) {
  return useQuery({
    queryKey: [...rankingKey, vacancyId],
    queryFn: () => api.get(`/admin/vacancies/${vacancyId}/ranking`),
    enabled: Boolean(vacancyId),
  });
}

/**
 * GET /api/admin/applications/:id/packet → { blob, filename } (decisions 21, 33: the endorsement packet, downloaded from
 * the Ranking tab; HR only, built on request).
 */
export function downloadPacket(applicationId) {
  return api.download(`/admin/applications/${applicationId}/packet`);
}

/**
 * POST /api/admin/vacancies/:id/notify { applicationIds, message, finalInterviewAt, finalInterviewDetails } →
 * { endorsementId, notified, status, vacancyStatus, remaining } (decision 39-3: Notify = the endorsement)
 */
export function useNotify(vacancyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/admin/vacancies/${vacancyId}/notify`, body),
    onSettled: () => {
      for (const key of [rankingKey, vacanciesKey, endorsementsKey, ["interviews"]]) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
