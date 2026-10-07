// pnpm --filter api seed:applicant -- --email demo1@vera.test
// Creates (or repairs) a confirmed demo APPLICANT account without email confirmation, for demos and tests.
// - Password from DEMO_APPLICANT_PASSWORD in apps/api/.env; never changed for an existing user.
// - Data Privacy Act consent is recorded in user_metadata like a real sign-up (SignUpForm), but marked
//   privacy_consent_source = "seed:applicant (demo account)"; an existing consent is never overwritten.
// - Does NOT create the applicant row: sign in and go through /applicant/setup (resume → confirm profile),
//   so matching uses a real stored extraction (CLAUDE.md rule 5).
// - Repairs users created in the Supabase dashboard: confirms them and adds the missing user_account row.
// Safe to run more than once. Never changes admin or HR accounts.
import "dotenv/config";

import { ACCOUNT_STATUS, ROLES } from "@vera/shared";

import { pool } from "../src/db/pool.js";
import { supabaseAdmin } from "../src/lib/supabaseAdmin.js";

import { assertNotStaff, consentMetadata, parseEmailArg, passwordSchema } from "./applicant-seed.js";

async function findAuthUser(email) {
  const { rows } = await pool.query(
    `select u.id, u.raw_user_meta_data as "userMetadata", u.raw_app_meta_data as "appMetadata", a.role as "accountRole"
       from auth.users u
       left join public.user_account a on a.user_account_id = u.id
      where lower(u.email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

async function main() {
  const email = parseEmailArg(process.argv.slice(2));
  const existing = await findAuthUser(email);
  let userId;
  let action;
  let consent;

  if (!existing) {
    const password = passwordSchema.safeParse(process.env.DEMO_APPLICANT_PASSWORD);
    if (!password.success) {
      throw new Error(`Set DEMO_APPLICANT_PASSWORD in apps/api/.env (${password.error.issues[0].message}).`);
    }
    // Confirmed on creation, so the DB trigger creates user_account (role applicant).
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password.data,
      email_confirm: true,
      app_metadata: { vera_role: ROLES.APPLICANT },
      user_metadata: consentMetadata({}),
    });
    if (error) throw new Error(`could not create the demo applicant: ${error.message}`);
    userId = data.user.id;
    action = "created";
    consent = "recorded";
  } else {
    assertNotStaff({ accountRole: existing.accountRole, appMetadataRole: existing.appMetadata?.vera_role });
    const userMetadata = consentMetadata(existing.userMetadata ?? {});
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      app_metadata: { ...(existing.appMetadata ?? {}), vera_role: ROLES.APPLICANT },
      ...(userMetadata && { user_metadata: userMetadata }),
    });
    if (error) throw new Error(`could not repair the demo applicant: ${error.message}`);
    userId = existing.id;
    action = "repaired";
    consent = userMetadata ? "recorded" : "kept";
  }

  // Covers auth users the trigger never saw (created unconfirmed, or before the schema existed).
  await pool.query(
    `insert into public.user_account (user_account_id, email, role, account_status, auth_provider)
     values ($1, $2, $3, $4, 'email')
     on conflict (user_account_id) do update set account_status = excluded.account_status`,
    [userId, email, ROLES.APPLICANT, ACCOUNT_STATUS.ACTIVE],
  );

  // No email in the log (CLAUDE.md rule 9).
  console.log(`demo applicant account ${action}; consent ${consent}; next: sign in and complete /applicant/setup`);
}

try {
  await main();
} catch (error) {
  console.error(`seed:applicant failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
