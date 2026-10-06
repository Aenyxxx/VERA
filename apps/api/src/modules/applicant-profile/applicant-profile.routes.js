import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { confirm } from "./applicant-profile.controller.js";
import { confirmProfileSchema } from "./applicant-profile.schemas.js";

export const applicantProfileRouter = Router();

applicantProfileRouter.post("/confirm", validate({ body: confirmProfileSchema }), confirm);
