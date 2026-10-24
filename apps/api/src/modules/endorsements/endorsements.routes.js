// Endorsement Management routes (TRD §6.3, S16 + Phase 2), mounted on the admin area (admin + HR only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import {
  create,
  finalInterview,
  forHiring,
  list,
  outcome,
  packet,
  print,
  removeCandidate,
  show,
  trainingFailed,
} from "./endorsements.controller.js";
import {
  applicationParams,
  createSchema,
  endorsementParams,
  finalInterviewSchema,
  itemParams,
  noBody,
  outcomeSchema,
  removeSchema,
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
// Decision 33: the packet is downloaded from the Ranking tab, by application (replaces /endorsement-items/:id/packet).
endorsementsRouter.get("/applications/:id/packet", validate({ params: applicationParams }), packet);
endorsementsRouter.post("/applications/:id/training-failed", validate({ params: applicationParams, body: noBody }), trainingFailed);
// Decision 37B: the applicant will not continue (told the agency): for_endorsement → archived (neutral)
endorsementsRouter.post("/applications/:id/remove-from-endorsement", validate({ params: applicationParams, body: removeSchema }), removeCandidate);
