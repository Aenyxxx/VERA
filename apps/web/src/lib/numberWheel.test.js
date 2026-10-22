// Decision 35 follow-up: the wheel never changes a focused number field.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { preventNumberWheel } from "./numberWheel";

describe("preventNumberWheel", () => {
  let uninstall;
  beforeEach(() => {
    uninstall = preventNumberWheel();
  });
  afterEach(() => {
    uninstall();
    document.body.innerHTML = "";
  });

  function field(type, value) {
    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    document.body.append(input);
    input.focus();
    return input;
  }

  it("blurs a focused number field on wheel and keeps its value", () => {
    const input = field("number", "8");
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(document.activeElement).not.toBe(input);
    expect(input.value).toBe("8");
  });

  it("leaves other fields and unfocused number fields alone", () => {
    const text = field("text", "Juan");
    text.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(document.activeElement).toBe(text);

    const other = field("number", "3");
    text.focus();
    other.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(document.activeElement).toBe(text);
  });

  it("stops after uninstall", () => {
    uninstall();
    const input = field("number", "8");
    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(document.activeElement).toBe(input);
    uninstall = () => {};
  });
});
