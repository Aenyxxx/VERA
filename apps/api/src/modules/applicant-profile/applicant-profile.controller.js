import { confirmProfile } from "./applicant-profile.service.js";

// POST /api/applicant/profile/confirm
export async function confirm(req, res) {
  const result = await confirmProfile({ userId: req.auth.userId, profile: req.valid.body });
  res.status(201).json({ data: result });
}
