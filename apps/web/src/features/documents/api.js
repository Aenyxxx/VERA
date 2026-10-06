import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/apiClient";

export const resumeKey = ["applicant", "resume"];
export const documentsKey = ["applicant", "documents"];

/** GET /api/applicant/resume → the current resume (metadata only). */
export function useResume() {
  return useQuery({ queryKey: resumeKey, queryFn: () => api.get("/applicant/resume") });
}

/** GET /api/applicant/documents → current supporting documents, newest first. */
export function useDocuments() {
  return useQuery({ queryKey: documentsKey, queryFn: () => api.get("/applicant/documents") });
}

/** POST /api/applicant/documents (FR-DOC-01/04). Re-upload when replacesDocumentId is given. */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, documentType, label, replacesDocumentId }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("documentType", documentType);
      if (label) form.append("label", label);
      if (replacesDocumentId) form.append("replacesDocumentId", replacesDocumentId);
      return api.post("/applicant/documents", form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey }),
  });
}

/**
 * Open a private file in a new tab. Call it directly from the click handler: browsers only allow pop-ups
 * opened synchronously in a user gesture, so the blank tab is opened first and pointed at the signed URL
 * once the API returns it. If the request fails, the blank tab is closed and a toast explains why.
 * @param {string} path API path that returns { url }, e.g. /applicant/documents/<id>/url
 */
export function openSignedUrl(path) {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null; // the file page must not control the VERA tab

  return api
    .get(path)
    .then(({ url }) => {
      if (tab) tab.location.href = url;
      else toast.error("Allow pop-ups for VERA to view files.");
    })
    .catch((error) => {
      tab?.close();
      toast.error(error.message || "The file could not be opened. Please try again.", { duration: Infinity });
    });
}
