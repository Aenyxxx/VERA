// Ranking and Notify routes (TRD §6.2, §6.3, S15). Two routers: the admin one is mounted behind
// requireRole(admin, hr) under /admin/vacancies, the applicant one behind requireRole(applicant) under
// /applicant/applications.
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { confirmEndorsement, declineEndorsement, notifyPassed, ranking } from "./ranking.controller.js";
import { applicationParams, noBody, notifySchema, vacancyParams } from "./ranking.schemas.js";

export const adminRankingRouter = Router();

adminRankingRouter.get("/:id/ranking", validate({ params: vacancyParams }), ranking);
adminRankingRouter.post("/:id/notify", validate({ params: vacancyParams, body: notifySchema }), notifyPassed);

export const applicantEndorsementRouter = Router();

applicantEndorsementRouter.post("/:id/endorsement/confirm", validate({ params: applicationParams, body: noBody }), confirmEndorsement);
applicantEndorsementRouter.post("/:id/endorsement/decline", validate({ params: applicationParams, body: noBody }), declineEndorsement);
