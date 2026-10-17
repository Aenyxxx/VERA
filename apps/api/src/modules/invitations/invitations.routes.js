// Pool matching and job invitations, HR side (TRD §6.3, Phase 3). Mounted on the admin area under /vacancies
// (admin + HR only). The applicant answers through /applicant/offers (rematch routes), which dispatch on the kind.
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { invitations, poolMatching } from "./invitations.controller.js";
import { noBody, vacancyParams } from "./invitations.schemas.js";

export const adminInvitationsRouter = Router();

adminInvitationsRouter.get("/:id/invitations", validate({ params: vacancyParams }), invitations);
adminInvitationsRouter.post("/:id/pool-matching", validate({ params: vacancyParams, body: noBody }), poolMatching);
