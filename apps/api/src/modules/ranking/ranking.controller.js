import { answerEndorsement, getRanking, notifyApplicants } from "./ranking.service.js";

// GET /api/admin/vacancies/:id/ranking
export async function ranking(req, res) {
  res.json({ data: await getRanking(req.valid.params.id) });
}

// POST /api/admin/vacancies/:id/notify
export async function notifyPassed(req, res) {
  res.json({ data: await notifyApplicants(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/applicant/applications/:id/endorsement/confirm
export async function confirmEndorsement(req, res) {
  res.json({ data: await answerEndorsement(req.auth.userId, req.valid.params.id, "confirm") });
}

// POST /api/applicant/applications/:id/endorsement/decline
export async function declineEndorsement(req, res) {
  res.json({ data: await answerEndorsement(req.auth.userId, req.valid.params.id, "decline") });
}
