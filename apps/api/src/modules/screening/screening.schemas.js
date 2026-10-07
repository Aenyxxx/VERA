import { DROP_REASON_LABELS, REQUESTABLE_DOCUMENT_TYPES, VERIFICATION_STATUS } from "@vera/shared";
import { z } from "zod";

export const idParams = z.object({ id: z.uuid("Not found") });
export const vacancyParams = z.object({ vacancyId: z.uuid("Vacancy not found") });
export const documentParams = z.object({ id: z.uuid("Application not found"), documentId: z.uuid("Document not found") });

const remarks = z.string().trim().max(500).optional().transform((value) => value || null);

// HR marks one resume/document verified or rejected (FR-SCR-02). A rejection needs remarks (shown to HR later;
// HR then requests a new copy or drops the application). applicationId = the review sheet's application (slot lock).
export const verificationSchema = z
  .object({
    status: z.enum([VERIFICATION_STATUS.VERIFIED, VERIFICATION_STATUS.REJECTED], { error: "Choose verified or rejected." }),
    remarks,
    applicationId: z.uuid("Open the document from an application."),
  })
  .refine((v) => v.status !== VERIFICATION_STATUS.REJECTED || v.remarks, {
    path: ["remarks"],
    message: "Say why the document is rejected.",
  });

// FR-SCR-04: mandatory reason. The resume is not requestable while resume replacement is deferred.
export const documentRequestSchema = z.object({
  applicationId: z.uuid("Open an application first."),
  documentType: z.enum(REQUESTABLE_DOCUMENT_TYPES, { error: "Choose a supporting document type." }),
  targetDocumentId: z.uuid().optional(),
  reason: z.string().trim().min(3, "Give the applicant a reason.").max(500),
});

export const dropSchema = z.object({
  reason: z.enum(Object.keys(DROP_REASON_LABELS), { error: "Choose a reason." }),
  remarks,
});
