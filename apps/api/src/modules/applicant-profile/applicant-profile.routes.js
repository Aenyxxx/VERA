import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { confirm, show, update } from "./applicant-profile.controller.js";
import { profileSchema } from "./applicant-profile.schemas.js";

export const applicantProfileRouter = Router();

applicantProfileRouter.get("/", show);
applicantProfileRouter.patch("/", validate({ body: profileSchema }), update);
applicantProfileRouter.post("/confirm", validate({ body: profileSchema }), confirm);
