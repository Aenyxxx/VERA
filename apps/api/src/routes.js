// Mounts every module router under /api. Each module applies authenticate/requireRole itself.
import { Router } from "express";

import { healthRouter } from "./modules/health/health.routes.js";
import { meRouter } from "./modules/me/me.routes.js";

export const routes = Router();

routes.use("/health", healthRouter); // public
routes.use("/me", meRouter);
