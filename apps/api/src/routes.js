// Mounts every module router under /api. Each area applies authenticate/requireRole once.
import { ROLES, STAFF_ROLES } from "@vera/shared";
import { Router } from "express";

import { authenticate } from "./middleware/authenticate.js";
import { requireRole } from "./middleware/requireRole.js";
import { applicantProfileRouter } from "./modules/applicant-profile/applicant-profile.routes.js";
import { applicationsRouter } from "./modules/applications/applications.routes.js";
import { companiesRouter } from "./modules/companies/companies.routes.js";
import { competenciesRouter } from "./modules/competencies/competencies.routes.js";
import { documentRequestsRouter, documentsRouter } from "./modules/documents/documents.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { adminInterviewsRouter, applicantInterviewsRouter } from "./modules/interviews/interviews.routes.js";
import { meRouter } from "./modules/me/me.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { publicVacanciesRouter } from "./modules/public-vacancies/public-vacancies.routes.js";
import { resumesRouter } from "./modules/resumes/resumes.routes.js";
import { screeningRouter } from "./modules/screening/screening.routes.js";
import { vacanciesRouter } from "./modules/vacancies/vacancies.routes.js";

export const routes = Router();

routes.use("/health", healthRouter); // public
routes.use("/me", meRouter);
routes.use("/notifications", authenticate, requireRole(...Object.values(ROLES)), notificationsRouter); // every role, own feed only

// Applicant area (TRD §6.2)
const applicant = Router();
applicant.use(authenticate, requireRole(ROLES.APPLICANT));
applicant.use("/resume", resumesRouter);
applicant.use("/profile", applicantProfileRouter);
applicant.use("/documents", documentsRouter);
applicant.use("/document-requests", documentRequestsRouter); // FR-DOC-03 action items
applicant.use("/vacancies", publicVacanciesRouter); // agency-branded: never company fields (rule 4)
applicant.use("/applications", applicationsRouter); // apply + status panel: never company fields either
applicant.use("/interviews", applicantInterviewsRouter); // S13 confirm: job title only, link once confirmed
routes.use("/applicant", applicant);

// Admin / HR area (TRD §6.3)
const admin = Router();
admin.use(authenticate, requireRole(...STAFF_ROLES));
admin.use("/companies", companiesRouter);
admin.use("/competencies", competenciesRouter);
admin.use("/vacancies", vacanciesRouter);
admin.use(screeningRouter); // /screening, /applications/:id, /resumes|documents/:id/verification, /document-requests
admin.use(adminInterviewsRouter); // /interviewers, /interviews (S13)
routes.use("/admin", admin);
