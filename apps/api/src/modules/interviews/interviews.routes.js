// Interview routes (TRD §6.2, §6.3). Two routers: the admin one is mounted behind requireRole(admin, hr),
// the applicant one behind requireRole(applicant).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { confirm, edit, interviewers, list, mine, noShow, schedule } from "./interviews.controller.js";
import { editSchema, idParams, listQuery, scheduleSchema } from "./interviews.schemas.js";

export const adminInterviewsRouter = Router();

adminInterviewsRouter.get("/interviewers", interviewers);
adminInterviewsRouter.get("/interviews", validate({ query: listQuery }), list);
adminInterviewsRouter.post("/interviews", validate({ body: scheduleSchema }), schedule);
adminInterviewsRouter.patch("/interviews/:id", validate({ params: idParams, body: editSchema }), edit);
adminInterviewsRouter.post("/interviews/:id/no-show", validate({ params: idParams }), noShow);

export const applicantInterviewsRouter = Router();

applicantInterviewsRouter.get("/", mine);
applicantInterviewsRouter.post("/:id/confirm", validate({ params: idParams }), confirm);
