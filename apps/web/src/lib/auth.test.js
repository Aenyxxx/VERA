// Role redirect (FR-AUTH-01, logic behind TC-04).
import { describe, expect, it } from "vitest";

import { homePathFor, initialsOf } from "./auth";

describe("homePathFor", () => {
  it.each([
    [{ role: "admin", hasProfile: false }, "/admin"],
    [{ role: "hr", hasProfile: false }, "/admin"],
    [{ role: "applicant", hasProfile: true }, "/applicant"],
    [{ role: "applicant", hasProfile: false }, "/applicant/setup"],
  ])("%o → %s", (me, path) => {
    expect(homePathFor(me)).toBe(path);
  });
});

describe("initialsOf", () => {
  it("uses the first two words of a name, or the email's local part", () => {
    expect(initialsOf("Maria Clara Santos")).toBe("MC");
    expect(initialsOf("hr@vera.test")).toBe("H");
    expect(initialsOf("")).toBe("");
  });
});
