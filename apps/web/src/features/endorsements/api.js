import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// Endorsement Management (S16, HR only). Every action moves applications (and may fill the vacancy), so it refreshes
// the endorsement views, the ranking, the vacancy list and detail, screening, and interviews.
export const endorsementsKey = ["endorsements"];

/** GET /api/admin/endorsements → vacancies with endorsed (with the client) / hired (Deployed) counts. */
export function useEndorsementVacancies() {
  return useQuery({ queryKey: [...endorsementsKey, "list"], queryFn: () => api.get("/admin/endorsements") });
}

/** GET /api/admin/endorsements/:vacancyId → { vacancy, endorsements } (decision 39-3: Outcomes only, no candidates) */
export function useEndorsementVacancy(vacancyId) {
  return useQuery({
    queryKey: [...endorsementsKey, "vacancy", vacancyId],
    queryFn: () => api.get(`/admin/endorsements/${vacancyId}`),
    enabled: Boolean(vacancyId),
  });
}

/** GET /api/admin/endorsements/print/:endorsementId → the printable endorsement (HR document for the client). */
export function useEndorsementPrint(endorsementId) {
  return useQuery({
    queryKey: [...endorsementsKey, "print", endorsementId],
    queryFn: () => api.get(`/admin/endorsements/print/${endorsementId}`),
    enabled: Boolean(endorsementId),
  });
}

function useEndorsementMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      for (const key of [endorsementsKey, ["ranking"], ["vacancies"], ["screening"], ["interviews"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** PATCH /api/admin/endorsement-items/:id/outcome → { status, vacancyStatus, closeOut } */
export function useRecordOutcome() {
  return useEndorsementMutation(({ itemId, ...body }) => api.patch(`/admin/endorsement-items/${itemId}/outcome`, body));
}

/** POST /api/admin/endorsement-items/:id/final-interview { scheduledAt, details } (decision 14; also changes the time) */
export function useScheduleFinalInterview() {
  return useEndorsementMutation(({ itemId, ...body }) => api.post(`/admin/endorsement-items/${itemId}/final-interview`, body));
}

/**
 * Decision 37C: POST /api/admin/endorsement-items/:id/advance { to } → { itemId, applicationId, status }.
 * One stage forward: for_training (Proceed), for_requirements (Training passed), for_orientation.
 */
export function useAdvanceStage() {
  return useEndorsementMutation(({ itemId, to }) => api.post(`/admin/endorsement-items/${itemId}/advance`, { to }));
}

/**
 * Decision 39-3: POST /api/admin/endorsement-items/:id/remove { reason } → { itemId, applicationId, status: "archived" }.
 * Only at the final interview; neutral (no pool entry, no company block); the place counts again for Notify.
 */
export function useRemoveFromEndorsement() {
  return useEndorsementMutation(({ itemId, reason }) => api.post(`/admin/endorsement-items/${itemId}/remove`, { reason }));
}

/** POST /api/admin/endorsement-items/:id/training-failed (decision 37C: only at For training) → { itemId, applicationId, status } */
export function useTrainingFailed() {
  return useEndorsementMutation((itemId) => api.post(`/admin/endorsement-items/${itemId}/training-failed`));
}
