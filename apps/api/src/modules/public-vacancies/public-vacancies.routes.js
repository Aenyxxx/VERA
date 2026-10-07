import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { list, show } from "./public-vacancies.controller.js";
import { jobIdParams, listJobsQuery } from "./public-vacancies.schemas.js";

export const publicVacanciesRouter = Router();

publicVacanciesRouter.get("/", validate({ query: listJobsQuery }), list);
publicVacanciesRouter.get("/:id", validate({ params: jobIdParams }), show);
