// Sign-in block in Supabase Auth: staff (decision 19, User Management) and applicants (decision 37D, Applicant Pool).
// VERA itself refuses an inactive account in `authenticate` (403), so the ban is a second lock on sign-in, not the only
// one. Logs carry ids and error codes only (no names or emails).
import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

export const BANNED = "876000h"; // ~100 years: Supabase has no permanent ban value

/**
 * Bans the user. Never throws: the caller already committed the inactive status, so a failed ban is only logged and
 * reported (pressing Deactivate again retries it).
 * @param {string} userId
 * @param {string} context log label, e.g. "deactivate staff"
 * @returns {Promise<boolean>} true when Supabase accepted the ban
 */
export async function blockSignIn(userId, context) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: BANNED });
  if (error) logger.error({ userId, code: error.code, status: error.status }, `${context}: Supabase ban failed`);
  return !error;
}

/**
 * Lifts the ban. Throws 502 when Supabase refuses, so the caller changes nothing (activate = unban first).
 * @param {string} userId
 * @param {string} context log label, e.g. "activate staff"
 */
export async function unblockSignIn(userId, context) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    logger.error({ userId, code: error.code, status: error.status }, `${context}: Supabase unban failed`);
    throw new AppError(502, "AUTH_PROVIDER", "Could not unblock sign-in. Try again.");
  }
}
