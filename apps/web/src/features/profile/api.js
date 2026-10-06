import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

export const profileKey = ["applicant", "profile"];

/** POST /api/applicant/resume/parse → { profile, warnings, fileName, yearsExperience } (draft saved server-side). */
export function useParseResume() {
  return useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append("resume", file);
      return api.post("/applicant/resume/parse", form);
    },
  });
}

/** POST /api/applicant/profile/confirm → { applicantId } (applicant + resume + extraction saved together). */
export function useConfirmProfile() {
  return useMutation({ mutationFn: (profile) => api.post("/applicant/profile/confirm", profile) });
}

/** GET /api/applicant/profile → the confirmed profile card + account email. */
export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: () => api.get("/applicant/profile") });
}

/** PATCH /api/applicant/profile (FR-PROF-05). Refreshes /me so the header shows the new name. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile) => api.patch("/applicant/profile", profile),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
