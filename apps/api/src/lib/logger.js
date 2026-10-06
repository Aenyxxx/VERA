import pino from "pino";

import { env } from "../config/env.js";

// Never log PII (names, emails, resume text) or credentials; auth headers are redacted.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: ["req.headers.authorization", "req.headers.cookie"],
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
