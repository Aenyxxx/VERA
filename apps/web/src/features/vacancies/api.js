import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
      queryClient.setQueryData(vacancyKey(vacancy.vacancyId), vacancy);
      queryClient.invalidateQueries({ queryKey: vacanciesKey });
    },
  });
}

export const useCreateVacancy = () => useVacancyMutation((payload) => api.post("/admin/vacancies", payload));

export const useUpdateVacancy = (id) => useVacancyMutation((payload) => api.patch(`/admin/vacancies/${id}`, payload));

/** publish | close | reopen | archive; reopen may carry { applicationCap }. */
export const useVacancyAction = (id) =>
  useVacancyMutation(({ action, body }) => api.post(`/admin/vacancies/${id}/${action}`, body ?? {}));
