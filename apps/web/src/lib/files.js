export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB (FR-PROF-01; the API checks again)

/** Client-side check before uploading. Returns an error message, or "" when the file is fine. */
export function pdfProblem(file, maxBytes = MAX_PDF_BYTES) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are accepted. Save your file as a PDF and try again.";
  if (file.size > maxBytes) return "The file is larger than 10 MB. Upload a smaller PDF.";
  return "";
}
