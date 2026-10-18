// User Management routes (TRD §6.3, decision 19). Mounted behind requireRole(admin): HR gets 403.
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { create, list, status, update } from "./users.controller.js";
import { accountStatusSchema, createHrSchema, updateStaffSchema, userIdParams } from "./users.schemas.js";

export const usersRouter = Router();

usersRouter.get("/", list);
usersRouter.post("/", validate({ body: createHrSchema }), create);
usersRouter.patch("/:id", validate({ params: userIdParams, body: updateStaffSchema }), update);
usersRouter.patch("/:id/status", validate({ params: userIdParams, body: accountStatusSchema }), status);
