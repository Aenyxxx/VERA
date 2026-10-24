// Rematch routes (TRD §6.2, §6.3, S17). Two routers: the applicant one is mounted behind requireRole(applicant) under
// /applicant/offers, the admin one behind requireRole(admin, hr) on the admin area.
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import { acceptOffer, declineOffer, myOffers, pool, poolAccount, rematch } from "./rematch.controller.js";
import { accountSchema, applicationParams, noBody, offerParams, poolEntryParams, poolQuery } from "./rematch.schemas.js";

export const applicantOffersRouter = Router();

applicantOffersRouter.get("/", myOffers);
applicantOffersRouter.post("/:id/accept", validate({ params: offerParams, body: noBody }), acceptOffer);
applicantOffersRouter.post("/:id/decline", validate({ params: offerParams, body: noBody }), declineOffer);

export const adminRematchRouter = Router();

adminRematchRouter.get("/pool", validate({ query: poolQuery }), pool);
// Decision 37D: HR and admin activate / deactivate the applicant's account from the Applicant Pool
adminRematchRouter.patch("/pool/:talentPoolId/account", validate({ params: poolEntryParams, body: accountSchema }), poolAccount);
adminRematchRouter.post("/applications/:id/rematch", validate({ params: applicationParams, body: noBody }), rematch);
