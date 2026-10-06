import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: details ? { code, message, details } : { code, message } });

// Last middleware: every error leaves the API as { error: { code, message, details? } } (TRD §4).
// Express needs all 4 arguments to treat this as an error handler.
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return send(res, 400, "VALIDATION_ERROR", "Some fields are invalid", details);
  }
  if (err.type === "entity.parse.failed") {
    return send(res, 400, "VALIDATION_ERROR", "Request body is not valid JSON");
  }
  if (err.type === "entity.too.large") {
    return send(res, 413, "VALIDATION_ERROR", "Request body is too large");
  }

  // Name, code, and stack only: driver errors can carry row values (PII) in other fields such as pg's `detail`.
  logger.error({ name: err.name, code: err.code, stack: err.stack }, "unhandled error");
  return send(res, 500, "INTERNAL", "Something went wrong. Please try again.");
}
