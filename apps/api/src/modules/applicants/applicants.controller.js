import { changeApplicantAccountStatus, searchApplicants } from "./applicants.service.js";

// GET /api/admin/applicants
export async function list(req, res) {
  res.json(await searchApplicants(req.valid.query));
}

// PATCH /api/admin/applicants/:applicantId/account (decision 39-4)
export async function account(req, res) {
  res.json({ data: await changeApplicantAccountStatus(req.auth.userId, req.valid.params.applicantId, req.valid.body) });
}
