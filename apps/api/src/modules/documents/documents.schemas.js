import { DOCUMENT_TYPE, SUPPORTING_DOCUMENT_TYPES } from "@vera/shared";
import { z } from "zod";

// Multipart text fields that come with the PDF (FR-DOC-01). Empty strings from forms count as "not given".
export const uploadDocumentSchema = z
  .object({
    documentType: z.enum(SUPPORTING_DOCUMENT_TYPES, "Select a document type"),
    label: z
      .string()
      .trim()
      .max(100, "Use at most 100 characters")
      .optional()
      .transform((value) => value || null),
    replacesDocumentId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((value) => value || null),
  })
  .refine((value) => value.documentType !== DOCUMENT_TYPE.OTHER || value.label, {
    path: ["label"],
    message: "Name this document",
  });

export const documentIdParams = z.object({ id: z.uuid("Unknown document") });
