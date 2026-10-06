/**
 * Validates request parts with zod schemas. Parsed values go to req.valid.{params,query,body}
 * (Express 5's req.query is read-only); req.body is also replaced with the parsed body.
 * A ZodError is turned into 400 VALIDATION_ERROR by the errorHandler.
 * @param {{ params?: import("zod").ZodType, query?: import("zod").ZodType, body?: import("zod").ZodType }} schemas
 */
export const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ["params", "query", "body"]) {
    if (schemas[part]) {
      req.valid[part] = schemas[part].parse(req[part] ?? {});
    }
  }
  if (req.valid.body) {
    req.body = req.valid.body;
  }
  next();
};
