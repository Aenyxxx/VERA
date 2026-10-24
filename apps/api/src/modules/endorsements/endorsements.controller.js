import {
  createEndorsement,
  getEndorsementPrint,
  getEndorsementVacancies,
  getEndorsementVacancy,
  markForHiring,
  markTrainingFailed,
  recordOutcome,
  removeFromEndorsement,
  scheduleFinalInterview,
} from "./endorsements.service.js";
import { getEndorsementPacket } from "./packet.service.js";

// GET /api/admin/endorsements
export async function list(req, res) {
  res.json({ data: await getEndorsementVacancies() });
}

// GET /api/admin/endorsements/:vacancyId
export async function show(req, res) {
  res.json({ data: await getEndorsementVacancy(req.valid.params.vacancyId) });
}

// GET /api/admin/endorsements/print/:endorsementId
export async function print(req, res) {
  res.json({ data: await getEndorsementPrint(req.valid.params.endorsementId) });
}

// POST /api/admin/endorsements
export async function create(req, res) {
  res.status(201).json({ data: await createEndorsement(req.auth.userId, req.valid.body) });
}

// PATCH /api/admin/endorsement-items/:id/outcome
export async function outcome(req, res) {
  res.json({ data: await recordOutcome(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/endorsement-items/:id/final-interview
export async function finalInterview(req, res) {
  res.json({ data: await scheduleFinalInterview(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/endorsement-items/:id/for-hiring
export async function forHiring(req, res) {
  res.json({ data: await markForHiring(req.auth.userId, req.valid.params.id) });
}

// GET /api/admin/applications/:id/packet → the PDF itself (decisions 21, 33), never stored or cached
export async function packet(req, res) {
  const { fileName, bytes } = await getEndorsementPacket(req.valid.params.id);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Cache-Control": "no-store",
  });
  res.send(Buffer.from(bytes));
}

// POST /api/admin/applications/:id/remove-from-endorsement (decision 37B)
export async function removeCandidate(req, res) {
  res.json({ data: await removeFromEndorsement(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/applications/:id/training-failed
export async function trainingFailed(req, res) {
  res.json({ data: await markTrainingFailed(req.auth.userId, req.valid.params.id) });
}
