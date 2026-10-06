// Server-only Supabase client (secret key). Used to verify access tokens and manage auth users.
import { createClient } from "@supabase/supabase-js";

import { env } from "../config/env.js";

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
