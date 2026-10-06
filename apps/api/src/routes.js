// Mounts every module router under /api. Each area applies authenticate/requireRole once.
import { ROLES, STAFF_ROLES } from "@vera/shared";
import { Router } from "express";

import { authenticate } from "./middleware/authenticate.js";
import { requireRole } from "./middleware/requireRole.js";
import { applicantProfileRouter } from "./modules/applicant-profile/applicant-profile.routes.js";
import { companiesRouter } from "./modules/companies/companies.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { meRouter } from "./modules/me/me.routes.js";
import { resumesRouter } from "./modules/resumes/resumes.routes.js";

export const routes = Router();

routes.use("/health", healthRouter); // public
routes.use("/me", meRouter);

// Applicant area (TRD §6.2)
const applicant = Router();
applicant.use(authenticate, requireRole(ROLES.APPLICANT));
applicant.use("/resume", resumesRouter);
applicant.use("/profile", applicantProfileRouter);
applicant.use("/documents", documentsRouter);
routes.use("/applicant", applicant);

// Admin / HR area (TRD §6.3)
const admin = Router();
admin.use(authenticate, requireRole(...STAFF_ROLES));
admin.use("/companies", companiesRouter);
routes.use("/admin", admin);
