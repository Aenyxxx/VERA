import { Router } from "express";

import { list } from "./competencies.controller.js";

export const competenciesRouter = Router();

competenciesRouter.get("/", list);
