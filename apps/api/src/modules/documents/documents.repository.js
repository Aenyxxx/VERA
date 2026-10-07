import { REQUEST_STATUS } from "@vera/shared";

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

/**
 * FR-DOC-03: uploading the requested type fulfils the applicant's pending request(s) for it. For certificate/other
 * (several allowed) a request aimed at one copy is fulfilled only by re-uploading that copy.
 * Returns the fulfilled requests with the job title, for the HR notification.
 */
export async function fulfilPendingRequests(client, { applicantId, documentType, documentId, replacesDocumentId, multi }) {
  const { rows } = await client.query(
    `update public.document_request r
        set status = '${REQUEST_STATUS.FULFILLED}', fulfilled_document_id = $3, fulfilled_at = now()
       from public.application a
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where r.application_id = a.application_id
        and r.applicant_id = $1 and r.document_type = $2 and r.status = '${REQUEST_STATUS.PENDING}'
        and (not $5::boolean or r.target_document_id is null or r.target_document_id = $4::uuid)
      returning r.document_request_id as "requestId", r.application_id as "applicationId",
                a.job_vacancy_id as "vacancyId", v.job_title as "jobTitle"`,
    [applicantId, documentType, documentId, replacesDocumentId ?? null, multi],
  );
  return rows;
}

export async function findApplicantName(applicantId, db = pool) {
  const { rows } = await db.query(
    "select trim(concat_ws(' ', first_name, last_name)) as name from public.applicant where applicant_id = $1",
    [applicantId],
  );
  return rows[0]?.name ?? "An applicant";
}

/** GET /api/applicant/document-requests: pending first, then history. Job title only, never the company. */
export async function listMyRequests(applicantId, db = pool) {
  const { rows } = await db.query(
    `select r.document_request_id as "requestId", r.document_type as "documentType", r.reason, r.status,
            r.due_at as "dueAt", r.created_at as "requestedAt", r.fulfilled_at as "fulfilledAt",
            r.target_document_id as "targetDocumentId", v.job_title as "jobTitle"
       from public.document_request r
       left join public.application a on a.application_id = r.application_id
       left join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where r.applicant_id = $1
      order by (r.status = '${REQUEST_STATUS.PENDING}') desc, r.due_at asc, r.created_at desc`,
    [applicantId],
  );
  return rows;
}
