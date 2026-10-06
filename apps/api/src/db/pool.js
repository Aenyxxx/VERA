import pg from "pg";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  // The Supabase pooler's certificate chain is not in Node's default trust store, so ssl: true fails with "self-signed certificate in certificate chain".
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

// An idle client lost its connection; log without query data and let the pool replace it.
pool.on("error", (error) => {
  logger.error({ code: error.code }, "database pool error");
});
