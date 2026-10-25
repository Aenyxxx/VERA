import { describe, expect, it } from "vitest";

import { assertSystemMove, assertTransition, canDo, unarchiveStatus, VACANCY_ACTIONS } from "../src/domain/vacancyStatus.js";

describe("vacancy status transitions (APP_FLOW §5.2)", () => {
  it.each([
    ["draft", "publish", "open"],
    ["open", "close", "closed"],
    ["closed", "reopen", "open"],
    ["endorsing", "reopen", "open"],
    ["draft", "archive", "archived"],
    ["closed", "archive", "archived"],
    ["filled", "archive", "archived"], // decision 40-3
  ])("%s --%s--> %s", (from, action, to) => {
    expect(assertTransition(from, action)).toBe(to);
  });

  it.each([
    ["open", "publish"],
    ["open", "archive"],
    ["endorsing", "archive"], // decision 40-3: still refused (someone may be with the client)
    ["archived", "archive"],
    ["draft", "close"],
    ["draft", "reopen"],
    ["filled", "reopen"],
    ["archived", "publish"],
    ["archived", "reopen"], // decision 40-5: unarchive never opens; reopen afterwards
    ["draft", "unarchive"],
    ["open", "unarchive"],
    ["closed", "unarchive"],
    ["endorsing", "unarchive"],
    ["filled", "unarchive"],
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

  it("decision 40-3: archive starts from exactly draft, closed and filled", () => {
    expect(VACANCY_ACTIONS.archive.from).toEqual(["draft", "closed", "filled"]);
  });

  it("endorse and fill are never HR buttons (only publish, close, reopen, archive, unarchive)", () => {
    expect(Object.keys(VACANCY_ACTIONS)).toEqual(["publish", "close", "reopen", "archive", "unarchive"]);
  });

  it("decision 40-5: unarchive starts from archived only", () => {
    expect(VACANCY_ACTIONS.unarchive.from).toEqual(["archived"]);
    expect(canDo("archived", "unarchive")).toBe(true);
  });

  it.each([
    [{ postedAt: null, hiredCount: 0, slotsNeeded: 2 }, "draft"], // never published
    [{ postedAt: "2026-10-20T01:00:00.000Z", hiredCount: 2, slotsNeeded: 2 }, "filled"], // Deployed = slots
    [{ postedAt: "2026-10-20T01:00:00.000Z", hiredCount: 1, slotsNeeded: 2 }, "closed"],
    [{ postedAt: "2026-10-20T01:00:00.000Z", hiredCount: 0, slotsNeeded: 2 }, "closed"],
  ])("decision 40-5: unarchiveStatus(%o) → %s (never open)", (vacancy, to) => {
    expect(unarchiveStatus(vacancy)).toBe(to);
  });
});
