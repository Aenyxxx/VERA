import { describe, expect, it } from "vitest";

import { assertTransition, canDo } from "../src/domain/vacancyStatus.js";

describe("vacancy status transitions (APP_FLOW §5.2)", () => {
  it.each([
    ["draft", "publish", "open"],
    ["open", "close", "closed"],
    ["closed", "reopen", "open"],
    ["endorsing", "reopen", "open"],
    ["draft", "archive", "archived"],
    ["closed", "archive", "archived"],
  ])("%s --%s--> %s", (from, action, to) => {
    expect(assertTransition(from, action)).toBe(to);
  });

  it.each([
    ["open", "publish"],
    ["open", "archive"],
    ["draft", "close"],
    ["draft", "reopen"],
    ["filled", "reopen"],
    ["archived", "publish"],
  ])("refuses %s → %s with 409 BUSINESS_RULE", (from, action) => {
    expect(canDo(from, action)).toBe(false);
    expect(() => assertTransition(from, action)).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
  });
});
