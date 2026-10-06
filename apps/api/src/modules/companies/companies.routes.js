import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { create, list, show, update } from "./companies.controller.js";
import { companyIdParams, companySchema, listCompaniesQuery } from "./companies.schemas.js";

export const companiesRouter = Router();

companiesRouter.get("/", validate({ query: listCompaniesQuery }), list);
companiesRouter.post("/", validate({ body: companySchema }), create);
companiesRouter.get("/:id", validate({ params: companyIdParams }), show);
companiesRouter.patch("/:id", validate({ params: companyIdParams, body: companySchema }), update);
