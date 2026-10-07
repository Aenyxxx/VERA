import { Router } from "express";

import { uploadPdf } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";

import { list, requests, upload, url } from "./documents.controller.js";
import { documentIdParams, uploadDocumentSchema } from "./documents.schemas.js";

export const documentsRouter = Router();

documentsRouter.get("/", list);
documentsRouter.post("/", uploadPdf("file"), validate({ body: uploadDocumentSchema }), upload);
documentsRouter.get("/:id/url", validate({ params: documentIdParams }), url);

export const documentRequestsRouter = Router();

documentRequestsRouter.get("/", requests);
