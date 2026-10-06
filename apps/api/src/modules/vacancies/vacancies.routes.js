import { Router } from "express";
import { z } from "zod";

import { validate } from "../../middleware/validate.js";

import { create, defaults, list, show, statusAction, update } from "./vacancies.controller.js";
import { listVacanciesQuery, reopenSchema, vacancyIdParams, vacancySchema } from "./vacancies.schemas.js";

export const vacanciesRouter = Router();

const noBody = z.object({}).optional().default({});

vacanciesRouter.get("/defaults", defaults);
vacanciesRouter.get("/", validate({ query: listVacanciesQuery }), list);
vacanciesRouter.post("/", validate({ body: vacancySchema }), create);
vacanciesRouter.get("/:id", validate({ params: vacancyIdParams }), show);
vacanciesRouter.patch("/:id", validate({ params: vacancyIdParams }), update);
vacanciesRouter.post("/:id/publish", validate({ params: vacancyIdParams, body: noBody }), statusAction("publish"));
vacanciesRouter.post("/:id/close", validate({ params: vacancyIdParams, body: noBody }), statusAction("close"));
vacanciesRouter.post("/:id/reopen", validate({ params: vacancyIdParams, body: reopenSchema }), statusAction("reopen"));
vacanciesRouter.post("/:id/archive", validate({ params: vacancyIdParams, body: noBody }), statusAction("archive"));
