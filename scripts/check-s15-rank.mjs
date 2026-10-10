// Helper for scripts/check-s15.ps1: sorts rows with the JS ranking (apps/api/src/domain/ranking.js, VERA-ALGO
// RANK-03), so the check can compare the API's ranking order with the JS order of the same stored values.
// Input: env S15_RANK_INPUT = JSON [{ applicationId, finalScore, matchingScore, appliedAt }].
// Output: one JSON line, the application ids in rank order. Read-only; no database, no .env.
import { rankApplications } from "../apps/api/src/domain/ranking.js";

const rows = JSON.parse(process.env.S15_RANK_INPUT ?? "null");
if (!Array.isArray(rows)) {
  console.error("Set S15_RANK_INPUT to a JSON array.");
  process.exit(2);
}
console.log(JSON.stringify(rankApplications(rows).map((r) => r.applicationId)));
