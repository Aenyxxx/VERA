// Resume Screening routes (TRD §6.3), mounted on the admin area (admin + HR only).
import { Router } from "express";

import { validate } from "../../middleware/validate.js";

import {
  application,
  createRequest,
  deleteRequest,
  documentUrl,
  documentVerification,
  drop,
  overview,
  resumeUrl,
  resumeVerification,
  vacancy,
} from "./screening.controller.js";
import {
  documentParams,
  documentRequestSchema,
  dropSchema,
  idParams,
  vacancyParams,
  verificationSchema,
} from "./screening.schemas.js";

export const screeningRouter = Router();

screeningRouter.get("/screening", overview);
screeningRouter.get("/screening/:vacancyId", validate({ params: vacancyParams }), vacancy);
screeningRouter.get("/applications/:id", validate({ params: idParams }), application);
screeningRouter.get("/applications/:id/resume/url", validate({ params: idParams }), resumeUrl);
screeningRouter.get("/applications/:id/documents/:documentId/url", validate({ params: documentParams }), documentUrl);
screeningRouter.post("/applications/:id/drop", validate({ params: idParams, body: dropSchema }), drop);
screeningRouter.patch("/resumes/:id/verification", validate({ params: idParams, body: verificationSchema }), resumeVerification);
screeningRouter.patch("/documents/:id/verification", validate({ params: idParams, body: verificationSchema }), documentVerification);
screeningRouter.post("/document-requests", validate({ body: documentRequestSchema }), createRequest);
screeningRouter.delete("/document-requests/:id", validate({ params: idParams }), deleteRequest);
