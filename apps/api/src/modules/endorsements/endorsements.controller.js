import {
  advanceStage,
  getEndorsementPrint,
  getEndorsementVacancies,
  getEndorsementVacancy,
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

// PATCH /api/admin/endorsement-items/:id/outcome
export async function outcome(req, res) {
  res.json({ data: await recordOutcome(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/endorsement-items/:id/final-interview
export async function finalInterview(req, res) {
  res.json({ data: await scheduleFinalInterview(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/endorsement-items/:id/advance { to } (decision 37C)
export async function advance(req, res) {
  res.json({ data: await advanceStage(req.auth.userId, req.valid.params.id, req.valid.body) });
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

// POST /api/admin/endorsement-items/:id/remove (decision 39-3: only at the final interview)
export async function remove(req, res) {
  res.json({ data: await removeFromEndorsement(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/endorsement-items/:id/training-failed (decision 37C: only at For training)
export async function trainingFailed(req, res) {
  res.json({ data: await markTrainingFailed(req.auth.userId, req.valid.params.id) });
}
