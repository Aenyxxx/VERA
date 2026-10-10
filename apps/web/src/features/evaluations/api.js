import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { interviewsKey } from "@/features/interviews/api";
import { screeningKey } from "@/features/screening/api";
import { api } from "@/lib/apiClient";

// Evaluation and scores (S14, HR only). Saving refreshes the evaluation page, the interview list (the attempt
// becomes completed), and Resume Screening (the review sheet shows the result).
export const evaluationsKey = ["evaluations"];

/** GET /api/admin/applications/:id/evaluation → page data, canEvaluate / blockedReason, the stored evaluation. */
export function useEvaluation(applicationId) {
  return useQuery({
    queryKey: [...evaluationsKey, applicationId],
    queryFn: () => api.get(`/admin/applications/${applicationId}/evaluation`),
    enabled: Boolean(applicationId),
  });
}

function useEvaluationMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: evaluationsKey });
      queryClient.invalidateQueries({ queryKey: interviewsKey });
      queryClient.invalidateQueries({ queryKey: screeningKey });
    },
  });
}

/** POST /api/admin/applications/:id/evaluation { ratings } — ratings only; the API computes every score. */
export function useSaveEvaluation() {
  return useEvaluationMutation(({ applicationId, ratings }) => api.post(`/admin/applications/${applicationId}/evaluation`, { ratings }));
}

/** POST /api/admin/applications/:id/evaluation/reuse — no body (BR-21, WSM-03). */
export function useReuseRatings() {
  return useEvaluationMutation((applicationId) => api.post(`/admin/applications/${applicationId}/evaluation/reuse`));
}
