import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

export const companiesKey = ["companies"];
const companyKey = (id) => ["companies", "detail", id];

/** GET /api/admin/companies?search= → { data, meta }. pageSize 100: the table paginates on the client. */
export function useCompanies(search) {
  return useQuery({
    queryKey: [...companiesKey, "list", search],
    queryFn: () => api.list(`/admin/companies?search=${encodeURIComponent(search)}&pageSize=100`),
    placeholderData: keepPreviousData, // keep the rows visible while a new search loads
  });
}

/** GET /api/admin/companies/:id → company + counts (FR-COMP-03). */
export function useCompany(id) {
  return useQuery({ queryKey: companyKey(id), queryFn: () => api.get(`/admin/companies/${id}`), enabled: Boolean(id) });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (company) => api.post("/admin/companies", company),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companiesKey }),
  });
}

export function useUpdateCompany(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (company) => api.patch(`/admin/companies/${id}`, company),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companiesKey }),
  });
}
