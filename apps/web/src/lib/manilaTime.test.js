// Interview times are built in Philippine time with an explicit +08:00 offset, never browser-local time.
// Each case runs under several machine time zones (process.env.TZ is re-read by Node when it changes).
import process from "node:process"; // vitest runs in Node; the web lint config only knows browser globals

import { afterAll, describe, expect, it } from "vitest";

import { manilaIso, manilaParts, manilaTimeRange, manilaToday } from "./manilaTime";

const ORIGINAL_TZ = process.env.TZ;
const ZONES = ["UTC", "America/Los_Angeles", "Asia/Manila", "Asia/Tokyo", "Pacific/Kiritimati"];

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe.each(ZONES)("machine time zone %s", (zone) => {
  it("is really running in that zone (sanity check of the test itself)", () => {
    process.env.TZ = zone;
    const offset = new Date("2026-01-15T12:00:00Z").getTimezoneOffset();
    const expected = { UTC: 0, "America/Los_Angeles": 480, "Asia/Manila": -480, "Asia/Tokyo": -540, "Pacific/Kiritimati": -840 };
    expect(offset).toBe(expected[zone]);
  });

  it("manilaIso sends the typed wall-clock time with +08:00 and always means the same instant", () => {
    process.env.TZ = zone;
    const iso = manilaIso("2026-10-12", "10:00");
    expect(iso).toBe("2026-10-12T10:00:00+08:00");
    expect(new Date(iso).toISOString()).toBe("2026-10-12T02:00:00.000Z");
    // Late evening in Manila is the previous day in UTC and the next day nowhere else: still one instant.
    expect(new Date(manilaIso("2026-10-12", "23:30")).toISOString()).toBe("2026-10-12T15:30:00.000Z");
    expect(new Date(manilaIso("2026-10-12", "00:15")).toISOString()).toBe("2026-10-11T16:15:00.000Z");
  });

  it("manilaParts turns a stored UTC time back into the Philippine date and time (edit form)", () => {
    process.env.TZ = zone;
    expect(manilaParts("2026-10-12T02:00:00.000Z")).toEqual({ date: "2026-10-12", time: "10:00" });
    expect(manilaParts("2026-10-11T16:15:00.000Z")).toEqual({ date: "2026-10-12", time: "00:15" });
    // Round trip: what HR typed is what the form shows again.
    expect(manilaParts(manilaIso("2026-12-31", "23:59"))).toEqual({ date: "2026-12-31", time: "23:59" });
  });

  it("manilaToday and manilaTimeRange use Philippine time", () => {
    process.env.TZ = zone;
    expect(manilaToday(new Date("2026-10-11T17:00:00Z"))).toBe("2026-10-12"); // 1:00 AM Oct 12 in Manila
    expect(manilaTimeRange("2026-10-12T02:00:00.000Z", 30)).toBe("10:00 AM – 10:30 AM");
  });
});

describe("manilaIso input checks", () => {
  it("returns null for missing or malformed parts", () => {
    expect(manilaIso("", "10:00")).toBeNull();
    expect(manilaIso("2026-10-12", "")).toBeNull();
    expect(manilaIso("12/10/2026", "10:00")).toBeNull();
    expect(manilaIso("2026-10-12", "10:00 AM")).toBeNull();
  });
});
