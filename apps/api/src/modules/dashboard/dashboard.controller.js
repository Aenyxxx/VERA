import { getDashboard } from "./dashboard.service.js";

// GET /api/admin/dashboard
export async function show(req, res) {
  res.json({ data: await getDashboard() });
}
