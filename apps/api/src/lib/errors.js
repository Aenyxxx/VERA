// API errors. The errorHandler turns them into { error: { code, message, details? } } (TRD §4).

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message = "Invalid request", details) =>
  new AppError(400, "VALIDATION_ERROR", message, details);
export const unauthenticated = (message = "Please sign in again") => new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have access to this action") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message, details) => new AppError(409, "CONFLICT", message, details);
export const businessRule = (message, details) => new AppError(422, "BUSINESS_RULE", message, details);
export const svcUnavailable = (message = "The resume service is unavailable. Try again later.") =>
  new AppError(503, "SVC_UNAVAILABLE", message);
