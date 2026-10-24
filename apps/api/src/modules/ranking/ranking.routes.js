// Ranking and Notify routes (TRD §6.2, §6.3, S15), mounted behind requireRole(admin, hr) under /admin/vacancies.
// Decision 37B: the applicant's endorsement confirm/decline routes are removed (Notify is information only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { notifyPassed, ranking } from "./ranking.controller.js";
import { notifySchema, vacancyParams } from "./ranking.schemas.js";

export const adminRankingRouter = Router();

adminRankingRouter.get("/:id/ranking", validate({ params: vacancyParams }), ranking);
adminRankingRouter.post("/:id/notify", validate({ params: vacancyParams, body: notifySchema }), notifyPassed);
