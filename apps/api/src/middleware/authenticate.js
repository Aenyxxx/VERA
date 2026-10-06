import { ACCOUNT_STATUS } from "@vera/shared";

import { forbidden, unauthenticated } from "../lib/errors.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { findAccountById } from "../modules/me/me.repository.js";

// Verifies the Supabase access token and loads the VERA account (FR-AUTH-08). Sets req.auth.
export async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    throw unauthenticated("Missing access token");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw unauthenticated("Your session has expired. Please sign in again.");
  }

  // user_account exists only after the email is confirmed (DB trigger).
  const account = await findAccountById(data.user.id);
  if (!account) {
    throw unauthenticated("No VERA account for this sign-in. Confirm your email first.");
  }
  if (account.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
    throw forbidden("Your account is deactivated. Contact the agency.");
  }

  req.auth = {
    userId: account.userId,
    email: account.email,
    role: account.role,
    fullName: account.fullName,
  };
  next();
}
