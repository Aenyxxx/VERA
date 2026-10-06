import multer from "multer";

import { validationError } from "../lib/errors.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB (FR-PROF-01, FR-DOC-*)
const PDF_MAGIC = Buffer.from("%PDF");

/**
 * One PDF in field `field`, kept in memory, ≤ 10 MB, with a real PDF signature (TRD §10).
 * Multer size errors are turned into 400 by errorHandler.
 */
export function uploadPdf(field) {
  const single = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  }).single(field);

  return [
    single,
    (req, res, next) => {
      if (!req.file) throw validationError("Choose a PDF file to upload.");
      const looksLikePdf = req.file.buffer.subarray(0, 4).equals(PDF_MAGIC);
      if (req.file.mimetype !== "application/pdf" || !looksLikePdf) {
        throw validationError("Only PDF files are accepted. Save your resume as a PDF and try again.");
      }
      next();
    },
  ];
}
