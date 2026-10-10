import { describe, expect, it } from "vitest";

import { assertSystemMove, assertTransition, canDo, VACANCY_ACTIONS } from "../src/domain/vacancyStatus.js";

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

  it.each([
    ["open", "endorse", "endorsing"],
    ["closed", "endorse", "endorsing"],
    ["endorsing", "endorse", "endorsing"],
    ["open", "fill", "filled"],
    ["closed", "fill", "filled"],
    ["endorsing", "fill", "filled"],
  ])("system move (S16): %s --%s--> %s", (from, move, to) => {
    expect(assertSystemMove(from, move)).toBe(to);
  });

  it.each([
    ["draft", "endorse"],
    ["filled", "endorse"],
    ["archived", "endorse"],
    ["draft", "fill"],
    ["filled", "fill"],
    ["archived", "fill"],
  ])("refuses the system move %s → %s with 409", (from, move) => {
    expect(() => assertSystemMove(from, move)).toThrow(expect.objectContaining({ status: 409, code: "BUSINESS_RULE" }));
  });

  it("endorse and fill are never HR buttons (only publish, close, reopen, archive)", () => {
    expect(Object.keys(VACANCY_ACTIONS)).toEqual(["publish", "close", "reopen", "archive"]);
  });
});
