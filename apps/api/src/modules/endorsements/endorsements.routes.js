// Endorsement Management routes (TRD §6.3, S16 + Phase 2), mounted on the admin area (admin + HR only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { create, finalInterview, forHiring, list, outcome, packet, print, show, trainingFailed } from "./endorsements.controller.js";
import {
  applicationParams,
  createSchema,
  endorsementParams,
  finalInterviewSchema,
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
endorsementsRouter.post("/endorsement-items/:id/final-interview", validate({ params: itemParams, body: finalInterviewSchema }), finalInterview);
endorsementsRouter.post("/endorsement-items/:id/for-hiring", validate({ params: itemParams, body: noBody }), forHiring);
endorsementsRouter.patch("/endorsement-items/:id/outcome", validate({ params: itemParams, body: outcomeSchema }), outcome);
endorsementsRouter.get("/endorsement-items/:id/packet", validate({ params: itemParams }), packet);
endorsementsRouter.post("/applications/:id/training-failed", validate({ params: applicationParams, body: noBody }), trainingFailed);
