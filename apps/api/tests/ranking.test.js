// Final ranking per vacancy (RANK-03; PRD FR-END-01; TC-50): combined groups, stored scores, deterministic ties.
import { describe, expect, it } from "vitest";

import { compareRanking, rankApplications } from "../src/domain/ranking.js";

const row = (applicationId, finalScore, matchingScore, appliedHour, extra = {}) => ({
  applicationId,
  finalScore,
  matchingScore,
  appliedAt: `2026-10-08T${String(appliedHour).padStart(2, "0")}:00:00.000Z`,
  ...extra,
});
const order = (rows) => rankApplications(rows).map((r) => [r.rank, r.applicationId]);

describe("RANK-03 final ranking", () => {
  it("TC-50: one list for both groups, highest final score first", () => {
    const rows = [
      row("ft-1", 82.5, 87.5, 1, { applicantType: "first_time" }),
      row("ex-1", 78.41, 79.31, 2, { applicantType: "experienced" }),
      row("ex-2", 88.44, 99.38, 3, { applicantType: "experienced" }),
      row("ft-2", 64.66, 79.31, 4, { applicantType: "first_time" }),
    ];
    expect(order(rows)).toEqual([
      [1, "ex-2"],
      [2, "ft-1"],
      [3, "ex-1"],
      [4, "ft-2"],
    ]);
  });

  it("equal final: the higher matching score ranks first", () => {
    expect(order([row("a", 78.34, 76.67, 1), row("b", 78.34, 80, 2)])).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });

  it("equal final and matching: the earlier application ranks first", () => {
    expect(order([row("late", 80, 80, 5), row("early", 80, 80, 1)])).toEqual([
      [1, "early"],
      [2, "late"],
    ]);
  });

  it("everything equal: the application id decides, so every rank is unique", () => {
    expect(order([row("b2", 80, 80, 1), row("a1", 80, 80, 1)])).toEqual([
      [1, "a1"],
      [2, "b2"],
    ]);
  });

  it("compares the stored 2-decimal values as they are (78.41 above 78.40)", () => {
    expect(compareRanking(row("x", 78.41, 70, 2), row("y", 78.4, 90, 1))).toBeLessThan(0);
  });

  it("keeps every field of the row and does not change the input array", () => {
    const rows = [row("a", 70, 70, 2, { status: "did_not_pass" }), row("b", 90, 90, 1, { status: "passed" })];
    const ranked = rankApplications(rows);
    expect(ranked[0]).toEqual({ rank: 1, ...rows[1] });
    expect(rows.map((r) => r.applicationId)).toEqual(["a", "b"]);
  });
});
