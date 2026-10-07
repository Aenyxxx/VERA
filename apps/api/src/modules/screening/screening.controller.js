import {
  dropApplication,
  getApplicationForHr,
  getDocumentUrlForHr,
  getResumeUrlForHr,
  getScreeningOverview,
  getScreeningVacancy,
  requestDocument,
  verifyDocument,
  verifyResume,
  withdrawRequest,
} from "./screening.service.js";

// GET /api/admin/screening
export async function overview(req, res) {
  res.json({ data: await getScreeningOverview() });
}

// GET /api/admin/screening/:vacancyId
export async function vacancy(req, res) {
  res.json({ data: await getScreeningVacancy(req.valid.params.vacancyId) });
}

// GET /api/admin/applications/:id
export async function application(req, res) {
  res.json({ data: await getApplicationForHr(req.valid.params.id) });
}

// GET /api/admin/applications/:id/resume/url
export async function resumeUrl(req, res) {
  res.json({ data: await getResumeUrlForHr(req.valid.params.id) });
}

// GET /api/admin/applications/:id/documents/:documentId/url
export async function documentUrl(req, res) {
  res.json({ data: await getDocumentUrlForHr(req.valid.params.id, req.valid.params.documentId) });
}

// PATCH /api/admin/resumes/:id/verification
export async function resumeVerification(req, res) {
  res.json({ data: await verifyResume(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// PATCH /api/admin/documents/:id/verification
export async function documentVerification(req, res) {
  res.json({ data: await verifyDocument(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/document-requests
export async function createRequest(req, res) {
  res.status(201).json({ data: await requestDocument(req.auth.userId, req.valid.body) });
}

// DELETE /api/admin/document-requests/:id
export async function deleteRequest(req, res) {
  res.json({ data: await withdrawRequest(req.auth.userId, req.valid.params.id) });
}

// POST /api/admin/applications/:id/drop
export async function drop(req, res) {
  res.json({ data: await dropApplication(req.auth.userId, req.valid.params.id, req.valid.body) });
}
