// HR dashboard route (TRD §6.3, S18), mounted at /admin/dashboard behind requireRole(admin, hr).
import { Router } from "express";

import { show } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", show);
