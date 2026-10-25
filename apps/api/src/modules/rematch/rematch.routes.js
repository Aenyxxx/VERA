// Rematch routes (TRD §6.2, §6.3, S17). Two routers: the applicant one is mounted behind requireRole(applicant) under
// /applicant/offers, the admin one behind requireRole(admin, hr) on the admin area.
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { acceptOffer, declineOffer, myOffers, pool } from "./rematch.controller.js";
import { noBody, offerParams, poolQuery } from "./rematch.schemas.js";

export const applicantOffersRouter = Router();

applicantOffersRouter.get("/", myOffers);
applicantOffersRouter.post("/:id/accept", validate({ params: offerParams, body: noBody }), acceptOffer);
applicantOffersRouter.post("/:id/decline", validate({ params: offerParams, body: noBody }), declineOffer);

export const adminRematchRouter = Router();

adminRematchRouter.get("/pool", validate({ query: poolQuery }), pool);
// Decision 39-4: the account control moved to Applicant Management (PATCH /applicants/:applicantId/account);
// PATCH /pool/:talentPoolId/account (decision 37D) is removed → 404.
// Decision 39-2: no manual rematch (POST /applications/:id/rematch removed → 404); only the automatic one after Not hired.
