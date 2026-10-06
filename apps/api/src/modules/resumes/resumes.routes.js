import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { uploadPdf } from "../../middleware/upload.js";

import { parse } from "./resumes.controller.js";

export const resumesRouter = Router();

// TRD §7.3: parsing is expensive (svc + storage), so at most 20 requests per minute per IP.
const parseLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "BUSINESS_RULE", message: "Too many uploads. Wait a minute and try again." } },
});

resumesRouter.post("/parse", parseLimit, uploadPdf("resume"), parse);
