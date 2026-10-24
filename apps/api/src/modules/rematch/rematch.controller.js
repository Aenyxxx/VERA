import { answerOffer, changePoolAccountStatus, getMyOffers, getPool } from "./rematch.service.js";

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

// GET /api/admin/pool?tab=waiting|client&q=
export async function pool(req, res) {
  res.json({ data: await getPool(req.valid.query) });
}

// PATCH /api/admin/pool/:talentPoolId/account (decision 37D)
export async function poolAccount(req, res) {
  res.json({ data: await changePoolAccountStatus(req.auth.userId, req.valid.params.talentPoolId, req.valid.body) });
}
