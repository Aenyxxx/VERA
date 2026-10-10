import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// Endorsement Management (S16, HR only). Every action moves applications (and may fill the vacancy), so it refreshes
// the endorsement views, the ranking, the vacancy list and detail, screening, and interviews.
export const endorsementsKey = ["endorsements"];

/** GET /api/admin/endorsements → vacancies with for_endorsement / endorsed / hired counts. */
export function useEndorsementVacancies() {
  return useQuery({ queryKey: [...endorsementsKey, "list"], queryFn: () => api.get("/admin/endorsements") });
}

/** GET /api/admin/endorsements/:vacancyId → { vacancy, candidates, awaitingConfirmation, endorsements } */
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

/** POST /api/admin/endorsements { vacancyId } → { endorsementId, endorsed, standby, vacancyStatus } */
export function useCreateEndorsement() {
  return useEndorsementMutation((vacancyId) => api.post("/admin/endorsements", { vacancyId }));
}

/** PATCH /api/admin/endorsement-items/:id/outcome → { status, vacancyStatus, closeOut } */
export function useRecordOutcome() {
  return useEndorsementMutation(({ itemId, ...body }) => api.patch(`/admin/endorsement-items/${itemId}/outcome`, body));
}

/** POST /api/admin/applications/:id/training-failed → { applicationId, status } */
export function useTrainingFailed() {
  return useEndorsementMutation((applicationId) => api.post(`/admin/applications/${applicationId}/training-failed`));
}
