// Validated environment (TRD §12). Fails fast at startup with the names of the bad keys, never their values.
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SVC_URL: z.url().default("http://127.0.0.1:8000"),
  SVC_INTERNAL_KEY: z.string().min(32, "must be at least 32 characters"),
});

/** Parses an env-like object; throws one readable error listing every invalid key. */
export function parseEnv(source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment in apps/api/.env:\n${problems.join("\n")}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
