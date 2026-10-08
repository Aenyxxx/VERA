import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { myApplicationsKey } from "@/features/applications/api";
import { screeningKey } from "@/features/screening/api";
import { api } from "@/lib/apiClient";

// Interview scheduling (S13). HR actions refresh the interview list and Resume Screening (the application
// leaves the shortlist when scheduled; a no-show refills it).
export const interviewsKey = ["interviews"];
export const myInterviewsKey = ["applicant", "interviews"];

/** GET /api/admin/interviews → open attempts across vacancies (company, scores, and the link for HR). */
export function useInterviews() {
  return useQuery({ queryKey: [...interviewsKey, "list"], queryFn: () => api.get("/admin/interviews") });
}

/** GET /api/admin/interviewers → active HR and admin accounts. */
export function useInterviewers() {
  return useQuery({
    queryKey: [...interviewsKey, "interviewers"],
    queryFn: () => api.get("/admin/interviewers"),
    staleTime: 5 * 60 * 1000,
  });
}

function useHrInterviewMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: interviewsKey });
      queryClient.invalidateQueries({ queryKey: screeningKey });
    },
  });
}

/** POST /api/admin/interviews { applicationId, scheduledAt (+08:00), durationMinutes, meetingLink, interviewerId } */
export function useScheduleInterview() {
  return useHrInterviewMutation((body) => api.post("/admin/interviews", body));
}

/** PATCH /api/admin/interviews/:id — edit the time in place (a confirmed interview stays confirmed). */
export function useEditInterview() {
  return useHrInterviewMutation(({ interviewId, ...body }) => api.patch(`/admin/interviews/${interviewId}`, body));
}

/** POST /api/admin/interviews/:id/no-show → { interviewStatus, status: "dropped", promoted[] } */
export function useMarkNoShow() {
  return useHrInterviewMutation((interviewId) => api.post(`/admin/interviews/${interviewId}/no-show`));
}

/** GET /api/applicant/interviews → job title only; meetingLink only once confirmed. */
export function useMyInterviews() {
  return useQuery({ queryKey: myInterviewsKey, queryFn: () => api.get("/applicant/interviews") });
}

/** POST /api/applicant/interviews/:id/confirm */
export function useConfirmInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewId) => api.post(`/applicant/interviews/${interviewId}/confirm`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: myInterviewsKey });
      queryClient.invalidateQueries({ queryKey: myApplicationsKey });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
