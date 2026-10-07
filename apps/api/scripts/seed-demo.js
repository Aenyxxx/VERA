// pnpm --filter api seed:demo   (run after seed:admin)
// Adds the demo client companies with one open vacancy each (Kabayan Mart → Cashier, ClayGo → Store Crew)
// for the ROADMAP §5 demo script. Insert-only: rows that already exist are never changed. Safe to run more than once.
import "dotenv/config";

import { ROLES } from "@vera/shared";
import { z } from "zod";

import { pool } from "../src/db/pool.js";
import { withTransaction } from "../src/db/tx.js";

import { seedDemo } from "./demo-data.js";

const seedEnv = z.object({ HR_EMAIL: z.email() }).safeParse(process.env);
if (!seedEnv.success) {
  console.error("Fill in HR_EMAIL in apps/api/.env first (the same account seed:admin creates).");
  process.exit(1);
}

try {
  const { rows } = await pool.query(
    `select user_account_id as "userId" from public.user_account where lower(email) = lower($1) and role = $2`,
    [seedEnv.data.HR_EMAIL, ROLES.HR],
  );
  if (rows.length === 0) throw new Error("the HR account does not exist yet. Run pnpm --filter api seed:admin first");

  const hrUserId = rows[0].userId;
  const log = await withTransaction(hrUserId, (client) => seedDemo(client, hrUserId));
  for (const line of log) console.log(line);
} catch (error) {
  console.error(`seed:demo failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
