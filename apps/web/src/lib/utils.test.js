// cn(): tailwind-merge knows VERA's custom font sizes (index.css @theme --text-*), so a size and a colour both survive.
import { describe, expect, it } from "vitest";

import { cn } from "./utils";

const SIZES = ["display", "page-title", "section-title", "card-title", "body-lg", "body", "body-sm", "label-sm", "caption", "metric"];

describe("cn", () => {
  it.each(SIZES)("keeps text-%s next to a text colour", (size) => {
    expect(cn(`px-2 text-${size} font-semibold`, "bg-info-soft text-info")).toBe(`px-2 text-${size} font-semibold bg-info-soft text-info`);
  });

  it("a later size replaces an earlier one; a later colour replaces an earlier one", () => {
    expect(cn("text-label-sm text-heading", "text-body-lg text-primary")).toBe("text-body-lg text-primary");
  });

  it("the shadcn Badge pattern: base size, variant colour, tone colour from className", () => {
    expect(cn("text-label-sm font-semibold", "bg-primary text-primary-foreground", "bg-warning-soft text-warning")).toBe(
      "text-label-sm font-semibold bg-warning-soft text-warning",
    );
  });
});
