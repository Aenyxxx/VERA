import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

export const myApplicationsKey = ["applicant", "applications"];

/** GET /api/applicant/applications → status panel rows (no company, no scores). */
export function useMyApplications() {
  return useQuery({ queryKey: myApplicationsKey, queryFn: () => api.get("/applicant/applications") });
}

/**
 * POST /api/applicant/applications { vacancyId, applicantType } → { applicationId, status, message, failedConditions? }.
 * Prescreen and matching run right away (FR-APP-03/04), so the result comes back in the response.
 */
export function useApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/applicant/applications", body),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: myApplicationsKey });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] }); // the vacancy may have closed at the cap
    },
  });
}
