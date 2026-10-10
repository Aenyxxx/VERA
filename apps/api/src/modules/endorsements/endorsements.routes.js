// Endorsement Management routes (TRD §6.3, S16), mounted on the admin area (admin + HR only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { create, list, outcome, print, show, trainingFailed } from "./endorsements.controller.js";
import {
  applicationParams,
  createSchema,
  endorsementParams,
  itemParams,
  noBody,
  outcomeSchema,
  vacancyParams,
} from "./endorsements.schemas.js";

export const endorsementsRouter = Router();

endorsementsRouter.get("/endorsements", list);
endorsementsRouter.get("/endorsements/print/:endorsementId", validate({ params: endorsementParams }), print); // before /:vacancyId
endorsementsRouter.get("/endorsements/:vacancyId", validate({ params: vacancyParams }), show);
endorsementsRouter.post("/endorsements", validate({ body: createSchema }), create);
endorsementsRouter.patch("/endorsement-items/:id/outcome", validate({ params: itemParams, body: outcomeSchema }), outcome);
endorsementsRouter.post("/applications/:id/training-failed", validate({ params: applicationParams, body: noBody }), trainingFailed);
