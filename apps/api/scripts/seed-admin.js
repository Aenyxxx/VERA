// pnpm --filter api seed:admin
// Creates (or updates) the admin and one HR account. Simplified replacement for the
// User Management UI during the sprint (ROADMAP §6). Safe to run more than once.
import "dotenv/config";

import { ROLES } from "@vera/shared";
import { z } from "zod";

import { pool } from "../src/db/pool.js";
import { supabaseAdmin } from "../src/lib/supabaseAdmin.js";

// FR-AUTH-02: at least 8 characters, at least 1 letter and 1 number.
const password = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, "must be 8+ characters with at least 1 letter and 1 number");

const seedEnv = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: password,
    ADMIN_FULL_NAME: z.string().min(1).default("VERA Admin"),
    HR_EMAIL: z.email(),
    HR_PASSWORD: password,
    HR_FULL_NAME: z.string().min(1).default("VERA HR"),
  })
  .safeParse(process.env);

if (!seedEnv.success) {
  const problems = seedEnv.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
  console.error(`Fill these in apps/api/.env first:\n${problems.join("\n")}`);
  process.exit(1);
}

const accounts = [
  { role: ROLES.ADMIN, email: seedEnv.data.ADMIN_EMAIL, password: seedEnv.data.ADMIN_PASSWORD, fullName: seedEnv.data.ADMIN_FULL_NAME },
  { role: ROLES.HR, email: seedEnv.data.HR_EMAIL, password: seedEnv.data.HR_PASSWORD, fullName: seedEnv.data.HR_FULL_NAME },
];

async function findAuthUserId(email) {
  const { rows } = await pool.query("select id from auth.users where lower(email) = lower($1)", [email]);
  return rows[0]?.id ?? null;
}

async function seedAccount({ role, email, password, fullName }) {
  let userId = await findAuthUserId(email);
  let action;

  if (!userId) {
    // Confirmed on creation, so the DB trigger creates user_account with the role from app_metadata.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { vera_role: role },
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`could not create the ${role} account: ${error.message}`);
    userId = data.user.id;
    action = "created";
  } else {
    // Existing auth user (e.g. from the prototype): fix role and name; the password is left unchanged.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      app_metadata: { vera_role: role },
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`could not update the ${role} account: ${error.message}`);
    action = "updated";
  }

  // Covers auth users that existed before the schema (no trigger fired for them).
  await pool.query(
    `insert into public.user_account (user_account_id, email, role, full_name, account_status, auth_provider)
     values ($1, $2, $3, $4, 'active', 'email')
     on conflict (user_account_id) do update
       set role = excluded.role, full_name = excluded.full_name, account_status = 'active'`,
    [userId, email, role, fullName],
  );

  console.log(`${role} account ${action}`);
}

try {
  for (const account of accounts) {
    await seedAccount(account);
  }
} catch (error) {
  console.error(`seed:admin failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
