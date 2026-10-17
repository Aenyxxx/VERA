import { getVacancyInvitations, requestPoolMatching } from "./invitations.service.js";

// GET /api/admin/vacancies/:id/invitations → { running, poolMatchedAt, summary, invitations }
export async function invitations(req, res) {
  res.json({ data: await getVacancyInvitations(req.valid.params.id) });
}

// POST /api/admin/vacancies/:id/pool-matching → 202 { status: "started" } ("Run pool matching again")
export async function poolMatching(req, res) {
  res.status(202).json({ data: await requestPoolMatching(req.auth.userId, req.valid.params.id) });
}
