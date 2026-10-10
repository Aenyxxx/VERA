import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { APPLICATION_STATUS } from "@vera/shared";

import { api } from "@/lib/apiClient";

export const vacanciesKey = ["vacancies"];
const vacancyKey = (id) => ["vacancies", "detail", id];

export function useVacancies(search, status) {
  const params = new URLSearchParams({ search, pageSize: "100" });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: [...vacanciesKey, "list", search, status],
    queryFn: () => api.list(`/admin/vacancies?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useVacancy(id) {
  return useQuery({ queryKey: vacancyKey(id), queryFn: () => api.get(`/admin/vacancies/${id}`), enabled: Boolean(id) });
}

/** Form defaults from system_setting: { matchingThreshold, capMultiplier }. */
export function useVacancyDefaults() {
  return useQuery({ queryKey: ["vacancies", "defaults"], queryFn: () => api.get("/admin/vacancies/defaults"), staleTime: Infinity });
}

/** The fixed competency list (read-only). */
export function useCompetencies() {
  return useQuery({ queryKey: ["competencies"], queryFn: () => api.get("/admin/competencies"), staleTime: Infinity });
}

function useVacancyMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (vacancy) => {
      const detail = { ...vacancy };
      delete detail.closeOut; // archive adds close-out counts (S15), not part of the vacancy detail
      queryClient.setQueryData(vacancyKey(detail.vacancyId), detail);
      queryClient.invalidateQueries({ queryKey: vacanciesKey });
      if (vacancy.closeOut) {
        // the close-out moved applications: screening, interviews, and the ranking change too
        for (const key of [["screening"], ["interviews"], ["ranking"]]) queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export const useCreateVacancy = () => useVacancyMutation((payload) => api.post("/admin/vacancies", payload));

export const useUpdateVacancy = (id) => useVacancyMutation((payload) => api.patch(`/admin/vacancies/${id}`, payload));

const TO_NOT_SELECTED_IN_INTERVIEW = [APPLICATION_STATUS.INTERVIEW_SCHEDULED, APPLICATION_STATUS.INTERVIEW_CONFIRMED];
const TO_STANDBY = [APPLICATION_STATUS.PASSED, APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION, APPLICATION_STATUS.FOR_ENDORSEMENT];

/**
 * What archiving would close out (BR-22, S15), from three existing HR endpoints (no extra API):
 * screening (waiting + shortlisted, both groups) and open interviews → not selected; the ranking's passed / notified /
 * confirmed → standby; endorsed blocks archiving. Same moves as apps/api/src/domain/closeOut.js.
 * @returns {{ isPending: boolean, isError: boolean, counts: { notSelected: number, standby: number, endorsed: number } | null }}
 */
export function useCloseOutPreview(vacancyId, enabled) {
  const results = useQueries({
    queries: [
      { queryKey: ["screening", "vacancy", vacancyId], queryFn: () => api.get(`/admin/screening/${vacancyId}`), enabled },
      { queryKey: ["interviews", "vacancy", vacancyId], queryFn: () => api.get(`/admin/interviews?vacancyId=${vacancyId}`), enabled },
      { queryKey: ["ranking", vacancyId], queryFn: () => api.get(`/admin/vacancies/${vacancyId}/ranking`), enabled },
    ],
  });
  const [screening, interviews, ranking] = results;
  if (results.some((r) => r.isError)) return { isPending: false, isError: true, counts: null };
  if (results.some((r) => r.isPending)) return { isPending: true, isError: false, counts: null };

  const groups = Object.values(screening.data.groups);
  const inScreening = groups.reduce((sum, g) => sum + g.shortlisted.length + g.waitingPool.length, 0);
  const inInterview = interviews.data.filter((i) => TO_NOT_SELECTED_IN_INTERVIEW.includes(i.applicationStatus)).length;
  const statuses = ranking.data.ranking.map((r) => r.status);
  return {
    isPending: false,
    isError: false,
    counts: {
      notSelected: inScreening + inInterview,
      standby: statuses.filter((s) => TO_STANDBY.includes(s)).length,
      endorsed: statuses.filter((s) => s === APPLICATION_STATUS.ENDORSED).length,
    },
  };
}

/** publish | close | reopen | archive; reopen may carry { applicationCap }. */
export const useVacancyAction = (id) =>
  useVacancyMutation(({ action, body }) => api.post(`/admin/vacancies/${id}/${action}`, body ?? {}));
