import { listActiveCompetencies } from "./competencies.repository.js";

// GET /api/admin/competencies — read-only fixed list (competency management UI is deferred, ROADMAP §6)
export async function list(req, res) {
  res.json({ data: await listActiveCompetencies() });
}
