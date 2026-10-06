import { confirmProfile, editProfile, getProfile } from "./applicant-profile.service.js";

// POST /api/applicant/profile/confirm
export async function confirm(req, res) {
  const result = await confirmProfile({ userId: req.auth.userId, profile: req.valid.body });
  res.status(201).json({ data: result });
}

// GET /api/applicant/profile
export async function show(req, res) {
  res.json({ data: await getProfile(req.auth.userId) });
}

// PATCH /api/applicant/profile
export async function update(req, res) {
  res.json({ data: await editProfile({ userId: req.auth.userId, profile: req.valid.body }) });
}
