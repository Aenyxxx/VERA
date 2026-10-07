import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// Resume Screening (HR side). One key prefix, so every action refreshes the list, the shortlist, and the sheet.
export const screeningKey = ["screening"];

/** GET /api/admin/screening → vacancies with shortlist counts per group. */
export function useScreeningVacancies() {
  return useQuery({ queryKey: [...screeningKey, "vacancies"], queryFn: () => api.get("/admin/screening") });
}

/** GET /api/admin/screening/:vacancyId → both groups, waiting pools, and the not-shortlisted lists. */
export function useScreeningVacancy(vacancyId) {
  return useQuery({
    queryKey: [...screeningKey, "vacancy", vacancyId],
    queryFn: () => api.get(`/admin/screening/${vacancyId}`),
    enabled: Boolean(vacancyId),
  });
}

/** GET /api/admin/applications/:id → the review sheet. */
export function useReviewApplication(applicationId) {
  return useQuery({
    queryKey: [...screeningKey, "application", applicationId],
    queryFn: () => api.get(`/admin/applications/${applicationId}`),
    enabled: Boolean(applicationId),
  });
}

function useScreeningMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: screeningKey }),
  });
}

/** PATCH /api/admin/resumes/:id/verification · /api/admin/documents/:id/verification */
export function useVerify() {
  return useScreeningMutation(({ kind, id, status, remarks, applicationId }) =>
    api.patch(`/admin/${kind === "resume" ? "resumes" : "documents"}/${id}/verification`, {
      status,
      applicationId,
      ...(remarks ? { remarks } : {}),
    }),
  );
}

/** POST /api/admin/document-requests */
export function useRequestDocument() {
  return useScreeningMutation((body) => api.post("/admin/document-requests", body));
}

/** DELETE /api/admin/document-requests/:id */
export function useWithdrawRequest() {
  return useScreeningMutation((requestId) => api.delete(`/admin/document-requests/${requestId}`));
}

/** POST /api/admin/applications/:id/drop */
export function useDropApplication() {
  return useScreeningMutation(({ applicationId, reason, remarks }) =>
    api.post(`/admin/applications/${applicationId}/drop`, { reason, ...(remarks ? { remarks } : {}) }),
  );
}
