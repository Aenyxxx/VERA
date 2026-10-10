// Evaluation routes (TRD §6.3, S14), mounted on the admin area (admin + HR only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { evaluate, reuse, show } from "./evaluations.controller.js";
import { evaluationSchema, idParams, noBody } from "./evaluations.schemas.js";

export const evaluationsRouter = Router();

evaluationsRouter.get("/applications/:id/evaluation", validate({ params: idParams }), show);
evaluationsRouter.post("/applications/:id/evaluation", validate({ params: idParams, body: evaluationSchema }), evaluate);
evaluationsRouter.post("/applications/:id/evaluation/reuse", validate({ params: idParams, body: noBody }), reuse);
