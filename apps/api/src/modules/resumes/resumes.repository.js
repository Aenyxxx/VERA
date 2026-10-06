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
