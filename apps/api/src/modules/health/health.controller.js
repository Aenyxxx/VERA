import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";

async function checkDb() {
  try {
    await pool.query("select 1");
    return "up";
  } catch {
    return "down";
  }
}

async function checkSvc() {
  try {
    const response = await fetch(`${env.SVC_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

// GET /api/health — public. 503 only when the database is down; a down svc is reported as "degraded".
export async function getHealth(req, res) {
  const [db, svc] = await Promise.all([checkDb(), checkSvc()]);
  const status = db === "down" ? "down" : svc === "down" ? "degraded" : "ok";

  res.status(db === "up" ? 200 : 503).json({ data: { status, db, svc } });
}
