import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

/**
 * Decision 39-4: PATCH /api/admin/applicants/:applicantId/account { accountStatus, reason? } → { accountStatus,
 * signInBlocked, closedApplication?, expiredOffers? } (HR and admin; any applicant). Deactivating may close an ongoing
 * application, end a pending offer or invitation, and refresh a shortlist, so those views refresh too.
 */
export function useChangeApplicantAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicantId, ...body }) => api.patch(`/admin/applicants/${applicantId}/account`, body),
    onSettled: () => {
      for (const key of [["applicants"], ["pool"], ["vacancies"], ["endorsements"], ["ranking"], ["screening"], ["interviews"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
