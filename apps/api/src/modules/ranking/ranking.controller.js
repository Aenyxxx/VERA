import { getRanking, notifyApplicants } from "./ranking.service.js";

// GET /api/admin/vacancies/:id/ranking
export async function ranking(req, res) {
  res.json({ data: await getRanking(req.valid.params.id) });
}

// POST /api/admin/vacancies/:id/notify
export async function notifyPassed(req, res) {
  res.json({ data: await notifyApplicants(req.auth.userId, req.valid.params.id, req.valid.body) });
}
