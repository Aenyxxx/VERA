import { pool } from "../../db/pool.js";

/** The VERA account for a Supabase auth user, or null if it does not exist yet. */
export async function findAccountById(userId, db = pool) {
  const { rows } = await db.query(
    `select user_account_id as "userId", email, role, full_name as "fullName", account_status as "accountStatus"
       from public.user_account
      where user_account_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** True once the applicant has confirmed the auto-filled profile. */
export async function hasApplicantProfile(userId, db = pool) {
  const { rows } = await db.query(
    `select exists (select 1 from public.applicant where user_account_id = $1) as "hasProfile"`,
    [userId],
  );
  return rows[0].hasProfile;
}

/** "First Last" from the confirmed applicant profile, or null. Shown in the header instead of the email. */
export async function findApplicantName(userId, db = pool) {
  const { rows } = await db.query(
    `select trim(concat_ws(' ', first_name, last_name)) as "name" from public.applicant where user_account_id = $1`,
    [userId],
  );
  return rows[0]?.name || null;
}
