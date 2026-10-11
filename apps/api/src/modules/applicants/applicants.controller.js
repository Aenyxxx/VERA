import { searchApplicants } from "./applicants.service.js";

// GET /api/admin/applicants
export async function list(req, res) {
  res.json(await searchApplicants(req.valid.query));
}
