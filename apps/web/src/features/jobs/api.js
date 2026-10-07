import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

/** GET /api/applicant/vacancies?search= → open vacancies, agency-branded (no company fields). */
export function useJobs(search) {
  return useQuery({
    queryKey: ["jobs", "list", search],
    queryFn: () => api.list(`/applicant/vacancies?search=${encodeURIComponent(search)}&pageSize=100`),
    placeholderData: keepPreviousData,
  });
}

/** GET /api/applicant/vacancies/:id → 404 once the vacancy is no longer open. */
export function useJob(id) {
  return useQuery({ queryKey: ["jobs", "detail", id], queryFn: () => api.get(`/applicant/vacancies/${id}`) });
}
