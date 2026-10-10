import { evaluateApplication, getEvaluation, reuseRatings } from "./evaluations.service.js";

// GET /api/admin/applications/:id/evaluation
export async function show(req, res) {
  res.json({ data: await getEvaluation(req.valid.params.id) });
}

// POST /api/admin/applications/:id/evaluation
export async function evaluate(req, res) {
  res.status(201).json({ data: await evaluateApplication(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/applications/:id/evaluation/reuse
export async function reuse(req, res) {
  res.status(201).json({ data: await reuseRatings(req.auth.userId, req.valid.params.id) });
}
