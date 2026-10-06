import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/apiClient";

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
