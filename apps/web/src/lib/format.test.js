import { describe, expect, it } from "vitest";

import { ageFrom, formatBytes, formatDateTime } from "./format";

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [12_390, "12.1 KB"],
    [1_258_291, "1.2 MB"],
  ])("%i → %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("formatDateTime", () => {
  it("shows Philippine time (UTC+8)", () => {
    expect(formatDateTime("2026-10-08T01:14:00.000Z")).toBe("Oct 8, 2026, 9:14 AM");
    expect(formatDateTime("2026-10-07T20:30:00.000Z")).toBe("Oct 8, 2026, 4:30 AM");
  });
});

describe("ageFrom", () => {
  it("counts whole years, before and after the birthday", () => {
    const today = new Date(2026, 9, 8); // Oct 8, 2026
    expect(ageFrom("2002-07-10", today)).toBe(24);
    expect(ageFrom("2002-12-01", today)).toBe(23);
    expect(ageFrom("", today)).toBeNull();
  });
});
