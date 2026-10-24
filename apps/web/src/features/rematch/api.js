import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

// Automatic rematch after a client rejection (S17, PRD BR-23). Applicant side: job title, location, type, and deadline
// only (never the company or a score). HR side: the applicant pool (decision 39-2: no manual rematch).
export const myOffersKey = ["applicant", "offers"];
export const poolKey = ["pool"];

/** GET /api/applicant/offers → [{ offerId, jobTitle, deploymentLocation, employmentType, dueAt, offeredAt }] */
export function useMyOffers() {
  return useQuery({ queryKey: myOffersKey, queryFn: () => api.get("/applicant/offers") });
}

/**
 * POST /api/applicant/offers/:id/accept | /decline → { offerId, status, applicationId?, applicationStatus? }.
 * The offers list is refreshed only on success: after a 409 ("no longer available") the pop-up keeps showing the
 * message, and the status panel refreshes the offers when the applicant closes it.
 */
export function useAnswerOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, answer }) => api.post(`/applicant/offers/${offerId}/${answer}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myOffersKey }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * GET /api/admin/pool?tab=waiting|client&q= → active pool entries of free applicants with their latest offer or
 * invitation (decision 18 tabs), the account status and, while inactive, HR's reason (decision 37D). `q` searches the
 * name or email (blank = no filter).
 */
export function useApplicantPool(tab, q = "") {
  const search = q.trim();
  const query = new URLSearchParams({ tab, ...(search ? { q: search } : {}) });
  return useQuery({ queryKey: [...poolKey, tab, search], queryFn: () => api.get(`/admin/pool?${query}`) });
}

/**
 * Decision 37D: PATCH /api/admin/pool/:talentPoolId/account { accountStatus, reason? } → { accountStatus, signInBlocked,
 * expiredOffers? }. Deactivating ends a pending offer or invitation, so the vacancies' invitation lists refresh too.
 */
export function useChangePoolAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ talentPoolId, ...body }) => api.patch(`/admin/pool/${talentPoolId}/account`, body),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: poolKey });
      queryClient.invalidateQueries({ queryKey: ["vacancies"] });
    },
  });
}
