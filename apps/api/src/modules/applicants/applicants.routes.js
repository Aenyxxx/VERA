// Applicant Management routes (TRD §6.3, S18), mounted at /admin/applicants behind requireRole(admin, hr).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { list } from "./applicants.controller.js";
import { listApplicantsQuery } from "./applicants.schemas.js";

export const applicantsRouter = Router();

applicantsRouter.get("/", validate({ query: listApplicantsQuery }), list);
