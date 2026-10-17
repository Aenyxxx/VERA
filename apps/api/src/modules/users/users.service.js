// User Management (PRD FR-AUTH-07, FR-ADM-04; decision 19, Phase 4): the admin creates HR accounts and activates or
// deactivates staff accounts. Admin only (routes.js). Answer 13: nobody deactivates their own account or the last
// active admin, and deactivating also bans the user in Supabase Auth. VERA itself refuses an inactive account in
// `authenticate` (403), so the ban is a second lock on sign-in, not the only one.
import { ACCOUNT_STATUS, ROLES } from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { AppError, conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

import { emailTaken, findStaff, listStaff, lockActiveAdmins, setAccountStatus, upsertHrAccount } from "./users.repository.js";

const BANNED = "876000h"; // ~100 years: Supabase has no permanent ban value
const EMAIL_TAKEN = "An account with this email already exists.";

/** GET /api/admin/users */
export async function getStaff(adminId) {
  const rows = await listStaff();
  return rows.map((row) => ({ ...row, isSelf: row.userId === adminId }));
}

/**
 * POST /api/admin/users { email, fullName, temporaryPassword } → a confirmed HR account (role always hr). The
 * password goes only to Supabase: never stored by VERA, logged, or returned.
 */
export async function createHrAccount(adminId, { email, fullName, temporaryPassword }) {
  if (await emailTaken(email)) throw conflict(EMAIL_TAKEN);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true, // confirmed now, so the DB trigger creates user_account with the role below
    app_metadata: { vera_role: ROLES.HR },
    user_metadata: { full_name: fullName },
  });
  if (error) {
    // Another sign-up with this email won the race (Supabase checks its own users).
    if (error.status === 422 || /already/i.test(error.message ?? "")) throw conflict(EMAIL_TAKEN);
    logger.error({ code: error.code, status: error.status }, "create HR account: Supabase refused");
    throw new AppError(502, "AUTH_PROVIDER", "Could not create the account. Try again.");
  }

  return upsertHrAccount({ userId: data.user.id, email, fullName, createdBy: adminId });
}

/**
 * PATCH /api/admin/users/:id/status { accountStatus }.
 * Deactivate: the status commits first (VERA refuses the account from then on), then the Supabase ban; a failed ban
 * is reported as signInBlocked: false and pressing Deactivate again retries it.
 * Activate: the Supabase unban first (nothing changes if it fails), then the status.
 */
export async function changeAccountStatus(adminId, userId, accountStatus) {
  const target = await findStaff(userId);
  if (!target) throw notFound("Staff account not found.");

  if (accountStatus === ACCOUNT_STATUS.ACTIVE) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) {
      logger.error({ userId, code: error.code, status: error.status }, "activate staff: Supabase unban failed");
      throw new AppError(502, "AUTH_PROVIDER", "Could not unblock sign-in. Try again.");
    }
    await setAccountStatus(userId, ACCOUNT_STATUS.ACTIVE);
    return { userId, accountStatus: ACCOUNT_STATUS.ACTIVE, signInBlocked: false };
  }

  if (userId === adminId) throw conflict("You cannot deactivate your own account.");
  await withTransaction(adminId, async (client) => {
    const activeAdmins = await lockActiveAdmins(client); // DATABASE_SCHEMA §8: active admin rows, id order
    if (activeAdmins.includes(userId) && activeAdmins.length === 1) throw conflict("Keep at least one active admin.");
    await setAccountStatus(userId, ACCOUNT_STATUS.INACTIVE, client);
  });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: BANNED });
  if (error) logger.error({ userId, code: error.code, status: error.status }, "deactivate staff: Supabase ban failed");
  return { userId, accountStatus: ACCOUNT_STATUS.INACTIVE, signInBlocked: !error };
}
