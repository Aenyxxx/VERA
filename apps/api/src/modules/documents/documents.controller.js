import { getDocumentUrl, listDocumentRequests, listDocuments, uploadDocument } from "./documents.service.js";

// GET /api/applicant/documents
export async function list(req, res) {
  res.json({ data: await listDocuments(req.auth.userId) });
}

// POST /api/applicant/documents (multipart `file`, documentType, label?, replacesDocumentId?)
export async function upload(req, res) {
  const document = await uploadDocument({ userId: req.auth.userId, file: req.file, ...req.valid.body });
  res.status(201).json({ data: document });
}

// GET /api/applicant/documents/:id/url
export async function url(req, res) {
  res.json({ data: await getDocumentUrl(req.auth.userId, req.valid.params.id) });
}

// GET /api/applicant/document-requests
export async function requests(req, res) {
  res.json({ data: await listDocumentRequests(req.auth.userId) });
}
