import { ACCOUNT_STATUS, ROLES, STAFF_ROLES } from "@vera/shared";

import { pool } from "../../db/pool.js";

const STAFF_COLUMNS = `
  u.user_account_id as "userId", u.email, u.full_name as "fullName", u.role,
  u.account_status as "accountStatus", u.created_at as "createdAt"`;

/** User Management list (FR-AUTH-07): staff accounts only, admins first, then by name. Last sign-in from Supabase Auth. */
export async function listStaff(db = pool) {
  const { rows } = await db.query(
    `select ${STAFF_COLUMNS}, au.last_sign_in_at as "lastSignInAt"
       from public.user_account u
       left join auth.users au on au.id = u.user_account_id
      where u.role = any($1::public.user_role[])
      order by u.role, lower(coalesce(u.full_name, u.email))`,
    [STAFF_ROLES],
  );
  return rows;
}

/** One staff account (admin or HR), or null (applicants and unknown ids are not staff). */
export async function findStaff(userId, db = pool) {
  const { rows } = await db.query(
    `select ${STAFF_COLUMNS} from public.user_account u
      where u.user_account_id = $1 and u.role = any($2::public.user_role[])`,
    [userId, STAFF_ROLES],
  );
  return rows[0] ?? null;
}

/** True when any VERA account already uses this email (case-insensitive; unique index user_account_email_key). */
export async function emailTaken(email, db = pool) {
  const { rows } = await db.query(
    `select exists (select 1 from public.user_account where lower(email) = lower($1)) as "taken"`,
    [email],
  );
  return rows[0].taken;
}

/**
 * The new HR account row. The auth trigger normally inserted it already (role from app_metadata.vera_role); this
 * covers a missing row like seed:admin does and records who created it.
 */
export async function upsertHrAccount({ userId, email, fullName, createdBy }, db = pool) {
  const { rows } = await db.query(
    `insert into public.user_account (user_account_id, email, role, full_name, account_status, auth_provider, created_by)
     values ($1, $2, $3, $4, $5, 'email', $6)
     on conflict (user_account_id) do update
       set role = excluded.role, full_name = excluded.full_name, created_by = excluded.created_by
     returning ${STAFF_COLUMNS.replaceAll("u.", "")}`,
    [userId, email, ROLES.HR, fullName, ACCOUNT_STATUS.ACTIVE, createdBy],
  );
  return rows[0];
}

/**
 * Locks every active admin row in id order (DATABASE_SCHEMA §8, "Deactivate staff"), so two admins deactivating each
 * other wait for each other and the last-admin check below always sees the committed count.
 */
export async function lockActiveAdmins(client) {
  const { rows } = await client.query(
    `select user_account_id as "userId" from public.user_account
      where role = $1 and account_status = $2
      order by user_account_id
      for update`,
    [ROLES.ADMIN, ACCOUNT_STATUS.ACTIVE],
  );
  return rows.map((r) => r.userId);
}

export async function setAccountStatus(userId, accountStatus, db = pool) {
  const { rows } = await db.query(
    `update public.user_account set account_status = $2, updated_at = now()
      where user_account_id = $1
      returning user_account_id as "userId", account_status as "accountStatus"`,
    [userId, accountStatus],
  );
  return rows[0] ?? null;
}
