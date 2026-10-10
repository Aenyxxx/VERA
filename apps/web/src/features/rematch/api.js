import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { endorsementsKey } from "@/features/endorsements/api";
import { api } from "@/lib/apiClient";

// Automatic rematch after a client rejection (S17, PRD BR-23). Applicant side: job title, location, type, and deadline
// only (never the company or a score). HR side: the applicant pool and Run rematch again.
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

/** GET /api/admin/pool → active pool entries of free applicants with their latest rematch offer. */
export function useApplicantPool() {
  return useQuery({ queryKey: poolKey, queryFn: () => api.get("/admin/pool") });
}

/** POST /api/admin/applications/:id/rematch → { status: "offered", jobTitle, companyName, … } | { status: "no_match" } */
export function useRunRematch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId) => api.post(`/admin/applications/${applicationId}/rematch`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: endorsementsKey });
      queryClient.invalidateQueries({ queryKey: poolKey });
    },
  });
}
