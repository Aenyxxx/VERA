import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { list, readAll } from "./notifications.controller.js";
import { listNotificationsQuery } from "./notifications.schemas.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", validate({ query: listNotificationsQuery }), list);
notificationsRouter.post("/read-all", readAll);
