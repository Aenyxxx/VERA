import { answerOffer, getMyOffers, getPool, runRematch } from "./rematch.service.js";

// GET /api/applicant/offers
export async function myOffers(req, res) {
  res.json({ data: await getMyOffers(req.auth.userId) });
}

// POST /api/applicant/offers/:id/accept
export async function acceptOffer(req, res) {
  res.json({ data: await answerOffer(req.auth.userId, req.valid.params.id, "accept") });
}

// POST /api/applicant/offers/:id/decline
export async function declineOffer(req, res) {
  res.json({ data: await answerOffer(req.auth.userId, req.valid.params.id, "decline") });
}

// POST /api/admin/applications/:id/rematch
export async function rematch(req, res) {
  res.json({ data: await runRematch(req.auth.userId, req.valid.params.id) });
}

// GET /api/admin/pool
export async function pool(req, res) {
  res.json({ data: await getPool() });
}
