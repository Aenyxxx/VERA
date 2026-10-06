import { forbidden } from "../lib/errors.js";

/**
 * Allows the request only for the given roles (use ROLES from @vera/shared). Run after authenticate.
 * @param {...string} roles
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    throw forbidden();
  }
  next();
};
