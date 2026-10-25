// Applicant Management routes (TRD §6.3, S18), mounted at /admin/applicants behind requireRole(admin, hr).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { account, list } from "./applicants.controller.js";
import { accountSchema, applicantParams, listApplicantsQuery } from "./applicants.schemas.js";

export const applicantsRouter = Router();

applicantsRouter.get("/", validate({ query: listApplicantsQuery }), list);
// Decision 39-4: activate / deactivate any applicant's account (HR and admin; replaces PATCH /pool/:talentPoolId/account)
applicantsRouter.patch("/:applicantId/account", validate({ params: applicantParams, body: accountSchema }), account);
