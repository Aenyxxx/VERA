import { applyToVacancy, getMyApplications } from "./applications.service.js";

// POST /api/applicant/applications { vacancyId, applicantType }
export async function apply(req, res) {
  res.status(201).json({ data: await applyToVacancy(req.auth.userId, req.valid.body) });
}

// GET /api/applicant/applications
export async function list(req, res) {
  res.json({ data: await getMyApplications(req.auth.userId) });
}
