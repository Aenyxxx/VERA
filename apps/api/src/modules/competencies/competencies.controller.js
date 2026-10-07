import { listRubric } from "./competencies.repository.js";

// GET /api/admin/competencies — the Competency Profile: sections with their items (read-only; management UI deferred)
export async function list(req, res) {
  res.json({ data: await listRubric() });
}
