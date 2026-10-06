// Supabase Storage (private buckets: resumes, documents, endorsements). Tables store the path only.
import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

function fail(action, error) {
  // No file paths in logs: they contain user and applicant ids.
  logger.error({ action, message: error.message }, "storage error");
  return new AppError(500, "INTERNAL", "The file could not be saved. Please try again.");
}

export async function uploadFile(bucket, path, buffer, contentType = "application/pdf") {
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
  if (error) throw fail("upload", error);
}

export async function moveFile(bucket, from, to) {
  const { error } = await supabaseAdmin.storage.from(bucket).move(from, to);
  if (error) throw fail("move", error);
}

export async function removeFiles(bucket, paths) {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
  if (error) throw fail("remove", error);
}
