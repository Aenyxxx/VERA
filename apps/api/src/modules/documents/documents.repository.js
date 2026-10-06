import { pool } from "../../db/pool.js";

const DOCUMENT_COLUMNS = `
  supporting_document_id as "documentId", document_type as "documentType", label,
  original_filename as "fileName", file_size_bytes as "fileSizeBytes", uploaded_at as "uploadedAt",
  verification_status as "verificationStatus", verification_remarks as "verificationRemarks"`;

export async function findApplicantId(userId, db = pool) {
  const { rows } = await db.query("select applicant_id as \"applicantId\" from public.applicant where user_account_id = $1", [
    userId,
  ]);
  return rows[0]?.applicantId ?? null;
}

/** Current (not replaced) supporting documents, newest first. */
export async function listCurrentDocuments(applicantId, db = pool) {
  const { rows } = await db.query(
    `select ${DOCUMENT_COLUMNS}
       from public.supporting_document
      where applicant_id = $1 and is_current
      order by uploaded_at desc`,
    [applicantId],
  );
  return rows;
}

/** One of the applicant's own current documents (ownership check), with its storage path. */
export async function findCurrentDocument(applicantId, documentId, db = pool) {
  const { rows } = await db.query(
    `select ${DOCUMENT_COLUMNS}, file_path as "filePath"
       from public.supporting_document
      where applicant_id = $1 and supporting_document_id = $2 and is_current`,
    [applicantId, documentId],
  );
  return rows[0] ?? null;
}

/** FR-DOC-04: a replaced document stays on record (HR history) but is no longer current. */
export async function retireDocument(client, applicantId, documentId) {
  await client.query(
    `update public.supporting_document set is_current = false, replaced_at = now()
      where applicant_id = $1 and supporting_document_id = $2 and is_current`,
    [applicantId, documentId],
  );
}

/** Single-instance types (all but certificate/other): uploading the type again replaces the current one. */
export async function retireDocumentsOfType(client, applicantId, documentType) {
  await client.query(
    `update public.supporting_document set is_current = false, replaced_at = now()
      where applicant_id = $1 and document_type = $2 and is_current`,
    [applicantId, documentType],
  );
}

/** New document; verification starts as pending (reset on every re-upload). */
export async function insertDocument(client, { applicantId, documentType, label, filePath, fileName, fileSizeBytes }) {
  const { rows } = await client.query(
    `insert into public.supporting_document
       (applicant_id, document_type, label, file_path, original_filename, file_size_bytes)
     values ($1, $2, $3, $4, $5, $6)
     returning ${DOCUMENT_COLUMNS}`,
    [applicantId, documentType, label, filePath, fileName, fileSizeBytes],
  );
  return rows[0];
}
