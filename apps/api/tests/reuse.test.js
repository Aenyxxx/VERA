// WSM-03 source lookup (PRD BR-21): the most recent completed evaluation → its ratings source → the original interview.
// The SQL is checked here; TC-84 checks the chain on a real database.
import { describe, expect, it, vi } from "vitest";

import { reusedRatingsSource } from "../src/domain/reuse.js";

describe("reusedRatingsSource (WSM-03)", () => {
  it("follows ratings_source_application_id of the most recent other evaluation (chain-safe)", async () => {
    const source = { sourceApplicationId: "cashier-interview", jobTitle: "Cashier", companyName: "Kabayan Mart", ratedAt: "2026-10-09T01:00:00Z" };
    const db = { query: vi.fn().mockResolvedValue({ rows: [source] }) };

    await expect(reusedRatingsSource(db, "applicant-1", "third-application")).resolves.toEqual(source);
    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual(["applicant-1", "third-application"]);
    const flat = sql.replace(/\s+/g, " ");
    expect(flat).toMatch(/select fe\.ratings_source_application_id as source_id/);
    expect(flat).toMatch(/where a\.applicant_id = \$1 and a\.application_id <> \$2 order by fe\.computed_at desc limit 1/);
    // the returned application is the SOURCE (original interview), not the latest evaluated application
    expect(flat).toMatch(/join public\.application src on src\.application_id = latest\.source_id/);
  });

  it("returns null when the applicant has no earlier evaluation", async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(reusedRatingsSource(db, "applicant-1", "app")).resolves.toBeNull();
  });
});
