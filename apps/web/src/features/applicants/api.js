import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

/**
 * GET /api/admin/applicants?search=&status=&page=&pageSize= → { data, meta: { page, pageSize, total } } (FR-ADM-02, S18).
 * `status` is a tile key from APPLICANT_FILTERS (or empty for every applicant). The server pages the list.
 */
export function useApplicants({ search, status, page, pageSize }) {
  const query = new URLSearchParams({ search });
  if (status) query.set("status", status);
  query.set("page", String(page));
  query.set("pageSize", String(pageSize));
  return useQuery({
    queryKey: ["applicants", "list", { search, status, page, pageSize }],
    queryFn: () => api.list(`/admin/applicants?${query}`),
    placeholderData: keepPreviousData, // keep the rows visible while the next page or search loads
  });
}
