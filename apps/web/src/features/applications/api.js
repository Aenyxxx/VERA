import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BLOCKS_APPLYING_STATUSES } from "@vera/shared";

import { api } from "@/lib/apiClient";

export const myApplicationsKey = ["applicant", "applications"];

/** GET /api/applicant/applications → status panel rows (no company, no scores). */
export function useMyApplications() {
  return useQuery({ queryKey: myApplicationsKey, queryFn: () => api.get("/applicant/applications") });
}

/**
 * The applicant's ongoing or hired application (BR-17), or null. While it exists the applicant cannot apply
 * anywhere; the API refuses with 409 too.
 */
export function useBlockingApplication() {
  const applications = useMyApplications();
  return {
    isPending: applications.isPending,
    blocking: applications.data?.find((a) => BLOCKS_APPLYING_STATUSES.includes(a.status)) ?? null,
  };
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
