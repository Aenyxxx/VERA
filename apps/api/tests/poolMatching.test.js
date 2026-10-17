// RANK-05 (Phase 3, decision 17): who pool matching invites. Prescreen first (svc never called for a failure), then the
// stored-score threshold rule of RANK-02 (39.995 → 40.00 meets 40). No ranking: everyone who qualifies is invited.
import { describe, expect, it } from "vitest";

import { invitationExclusion } from "../src/domain/poolMatching.js";

describe("invitationExclusion (RANK-05)", () => {
  it("a prescreen failure is excluded before any matching", () => {
    expect(invitationExclusion({ prescreenPassed: false })).toBe("prescreen");
    expect(invitationExclusion({ prescreenPassed: false, matchingScore: 99, matchingThreshold: 40 })).toBe("prescreen");
  });

  it("below the vacancy's threshold is excluded; at or above is invited (stored 2-decimal score, RANK-02)", () => {
    expect(invitationExclusion({ prescreenPassed: true, matchingScore: 39.99, matchingThreshold: 40 })).toBe("below_threshold");
    expect(invitationExclusion({ prescreenPassed: true, matchingScore: 40, matchingThreshold: 40 })).toBe(null);
    expect(invitationExclusion({ prescreenPassed: true, matchingScore: 71.15, matchingThreshold: 40 })).toBe(null);
    expect(invitationExclusion({ prescreenPassed: true, matchingScore: 71.15, matchingThreshold: 80 })).toBe("below_threshold");
  });
});
