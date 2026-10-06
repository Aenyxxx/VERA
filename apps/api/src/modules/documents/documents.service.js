import { randomUUID } from "node:crypto";

import { MULTI_DOCUMENT_TYPES } from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { notFound, validationError } from "../../lib/errors.js";
import { removeFiles, signedUrl, uploadFile } from "../../lib/storage.js";

import {
  findApplicantId,
  findCurrentDocument,
  insertDocument,
  listCurrentDocuments,
  retireDocument,
  retireDocumentsOfType,
} from "./documents.repository.js";

const BUCKET = "documents";

async function requireApplicantId(userId) {
  const applicantId = await findApplicantId(userId);
  if (!applicantId) throw notFound("Your profile is not set up yet.");
  return applicantId;
}

export async function listDocuments(userId) {
  return listCurrentDocuments(await requireApplicantId(userId));
}

/**
 * Upload a supporting document (FR-DOC-01/02) or re-upload one (FR-DOC-04).
 * One current document per type, except certificate/other, which are replaced only through their own row.
 * The file is stored before the transaction and removed again if the transaction fails.
 */
export async function uploadDocument({ userId, file, documentType, label, replacesDocumentId }) {
  const applicantId = await requireApplicantId(userId);

  if (replacesDocumentId) {
    const old = await findCurrentDocument(applicantId, replacesDocumentId);
    if (!old) throw notFound("That document was not found.");
    if (old.documentType !== documentType) throw validationError("A re-upload must be the same document type.");
  }

  const filePath = `${applicantId}/${randomUUID()}.pdf`;
  await uploadFile(BUCKET, filePath, file.buffer);

  try {
    return await withTransaction(userId, async (client) => {
      if (replacesDocumentId) await retireDocument(client, applicantId, replacesDocumentId);
      else if (!MULTI_DOCUMENT_TYPES.includes(documentType)) await retireDocumentsOfType(client, applicantId, documentType);

      return insertDocument(client, {
        applicantId,
        documentType,
        label,
        filePath,
        fileName: file.originalname.slice(0, 255),
        fileSizeBytes: file.size,
      });
    });
  } catch (error) {
    await removeFiles(BUCKET, [filePath]).catch(() => {});
    throw error;
  }
}

/** Signed link (10 min) to one of the applicant's own current documents. */
export async function getDocumentUrl(userId, documentId) {
  const document = await findCurrentDocument(await requireApplicantId(userId), documentId);
  if (!document) throw notFound("That document was not found.");
  return { url: await signedUrl(BUCKET, document.filePath) };
}
