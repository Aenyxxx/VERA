import { Router } from "express";
import { MemoryStore, rateLimit } from "express-rate-limit";

import { validate } from "../../middleware/validate.js";

import { apply, list } from "./applications.controller.js";
import { applySchema } from "./applications.schemas.js";

export const applicationsRouter = Router();

// TRD §7.3: applying calls the svc (SBERT), so at most 20 requests per minute per IP.
export const applyLimitStore = new MemoryStore(); // exported so tests can reset it
const applyLimit = rateLimit({
  store: applyLimitStore,
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "BUSINESS_RULE", message: "Too many applications at once. Wait a minute and try again." } },
});

applicationsRouter.get("/", list);
applicationsRouter.post("/", applyLimit, validate({ body: applySchema }), apply);
