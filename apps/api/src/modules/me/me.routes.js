import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { getMe } from "./me.controller.js";

export const meRouter = Router();

meRouter.get("/", authenticate, getMe);
