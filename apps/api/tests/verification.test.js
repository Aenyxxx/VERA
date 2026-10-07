// FR-SCR-06 "fully verified" and the BR-08 response deadline (decided Oct 7, 2026).
import { describe, expect, it, vi } from "vitest";

import { isFullyVerified, responseDueAt } from "../src/domain/verification.js";

const doc = (verificationStatus) => ({ verificationStatus });

describe("isFullyVerified", () => {
  it("resume + every current supporting document verified + no pending request", () => {
    expect(isFullyVerified({ resume: doc("verified"), documents: [doc("verified"), doc("verified")], requests: [] })).toBe(true);
  });

  it("a resume that is not verified (or missing) blocks it", () => {
    expect(isFullyVerified({ resume: doc("pending"), documents: [], requests: [] })).toBe(false);
    expect(isFullyVerified({ resume: null, documents: [], requests: [] })).toBe(false);
  });

  it.each(["pending", "rejected", "reupload_requested"])("a %s supporting document blocks it", (status) => {
    expect(isFullyVerified({ resume: doc("verified"), documents: [doc("verified"), doc(status)], requests: [] })).toBe(false);
  });

  it("a pending request blocks it; fulfilled or cancelled ones do not", () => {
    const base = { resume: doc("verified"), documents: [doc("verified")] };
    expect(isFullyVerified({ ...base, requests: [{ status: "pending" }] })).toBe(false);
    expect(isFullyVerified({ ...base, requests: [{ status: "fulfilled" }, { status: "cancelled" }] })).toBe(true);
  });

  it("has no per-vacancy list: an applicant with only a verified resume and no documents is fully verified", () => {
    expect(isFullyVerified({ resume: doc("verified"), documents: [], requests: [] })).toBe(true);
  });
});

describe("responseDueAt (BR-08)", () => {
  const now = new Date("2026-10-08T00:00:00.000Z");
  const db = (days) => ({ query: vi.fn().mockResolvedValue({ rows: days === undefined ? [] : [{ days }] }) });

  it("adds system_setting.response_deadline_days", async () => {
    expect((await responseDueAt(db(5), now)).toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("defaults to 3 days when the setting is missing or invalid", async () => {
    expect((await responseDueAt(db(undefined), now)).toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect((await responseDueAt(db("abc"), now)).toISOString()).toBe("2026-10-11T00:00:00.000Z");
  });
});
