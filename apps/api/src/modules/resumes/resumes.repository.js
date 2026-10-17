import { INVITATION_STATUS } from "@vera/shared";

import { pool } from "../../db/pool.js";

/** The applicant's pending upload (between parse and confirm), or null. */
export async function findDraft(userId, db = pool) {
  const { rows } = await db.query(
    `select file_path as "filePath", original_filename as "originalFilename",
            file_size_bytes as "fileSizeBytes", extraction
       from public.resume_draft
      where user_account_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** One draft per user: a new parse replaces the previous one. */
export async function upsertDraft({ userId, filePath, originalFilename, fileSizeBytes, extraction }, db = pool) {
  await db.query(
    `insert into public.resume_draft (user_account_id, file_path, original_filename, file_size_bytes, extraction)
     values ($1, $2, $3, $4, $5)
     on conflict (user_account_id) do update
       set file_path = excluded.file_path,
           original_filename = excluded.original_filename,
           file_size_bytes = excluded.file_size_bytes,
           extraction = excluded.extraction,
           created_at = now()`,
    [userId, filePath, originalFilename, fileSizeBytes, extraction],
  );
}

export async function deleteDraft(userId, db = pool) {
  await db.query("delete from public.resume_draft where user_account_id = $1", [userId]);
}

/**
 * Decision 16: a pending job offer or job invitation stores matching computed from the current resume, so the resume
 * cannot be replaced until the applicant answers it.
 */
export async function hasPendingOffer(applicantId, db = pool) {
  const { rows } = await db.query(
    `select 1
       from public.pool_invitation pi
       join public.talent_pool tp on tp.talent_pool_id = pi.talent_pool_id
      where tp.applicant_id = $1 and pi.status = $2::public.invitation_status
      limit 1`,
    [applicantId, INVITATION_STATUS.PENDING],
  );
  return rows.length > 0;
}

/**
 * Decision 16: the current resume becomes an archived version (file kept). Applications keep pointing at it through
 * application.resume_id, so their matching and verification stay as they were.
 */
export async function archiveCurrentResume(client, applicantId) {
  await client.query(
    `update public.resume set is_current = false, archived_at = now()
      where applicant_id = $1 and is_current`,
    [applicantId],
  );
}

/** The applicant's current resume (one per applicant, BR-13), or null. */
export async function findCurrentResume(userId, db = pool) {
  const { rows } = await db.query(
    `select r.resume_id as "resumeId", r.file_path as "filePath", r.original_filename as "fileName",
            r.file_size_bytes as "fileSizeBytes", r.uploaded_at as "uploadedAt",
            r.verification_status as "verificationStatus", r.verification_remarks as "verificationRemarks"
       from public.resume r
       join public.applicant a on a.applicant_id = r.applicant_id
      where a.user_account_id = $1 and r.is_current`,
    [userId],
  );
  return rows[0] ?? null;
}
