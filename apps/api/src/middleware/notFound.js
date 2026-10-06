import { notFound as notFoundError } from "../lib/errors.js";

export function notFound(req, res, next) {
  next(notFoundError(`Route ${req.method} ${req.path} not found`));
}
