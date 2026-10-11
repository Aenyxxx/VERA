// HR dashboard (PRD FR-ADM-01, S18): the tile counts and the upcoming interviews. Read-only.
import { DASHBOARD_TILE_ORDER, DASHBOARD_TILES } from "@vera/shared";

import { countTiles, listUpcomingInterviews } from "./dashboard.repository.js";

/**
 * GET /api/admin/dashboard → { tiles: [{ key, label, counts, value, statuses? | blockingStatuses? | vacancyStatuses? }],
 * upcomingInterviews }. Each tile carries its own definition, so check-s18 compares against the same sets.
 */
export async function getDashboard() {
  const counts = await countTiles();
  const upcomingInterviews = await listUpcomingInterviews();
  return {
    tiles: DASHBOARD_TILE_ORDER.map((key) => ({ key, ...DASHBOARD_TILES[key], value: counts[key] })),
    upcomingInterviews,
  };
}
