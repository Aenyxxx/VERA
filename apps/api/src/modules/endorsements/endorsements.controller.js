import {
  createEndorsement,
  getEndorsementPrint,
  getEndorsementVacancies,
  getEndorsementVacancy,
  markTrainingFailed,
  recordOutcome,
} from "./endorsements.service.js";

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

// POST /api/admin/applications/:id/training-failed
export async function trainingFailed(req, res) {
  res.json({ data: await markTrainingFailed(req.auth.userId, req.valid.params.id) });
}
