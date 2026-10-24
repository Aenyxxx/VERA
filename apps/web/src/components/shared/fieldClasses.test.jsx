// Decision 39-1: every editable field is white (also in OS dark mode); disabled / read-only fields are light gray with
// readable text, never faded. One look for Input, Textarea and every native select (SELECT_CLASS).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { SELECT_CLASS } from "./fieldClasses";

describe("field look (decision 39-1)", () => {
  it("Input, Textarea and the shared select are white, light gray when disabled, and never gray in dark mode", () => {
    render(
      <>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <select aria-label="Status" className={SELECT_CLASS}>
          <option>Any</option>
        </select>
      </>,
    );
    for (const label of ["Name", "Notes", "Status"]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveClass("bg-card", "border-input", "disabled:bg-surface-subtle", "disabled:text-muted-foreground");
      expect(field).not.toHaveClass("dark:bg-input/30", "disabled:opacity-50", "disabled:opacity-70");
    }
    for (const label of ["Name", "Notes"]) expect(screen.getByLabelText(label)).toHaveClass("read-only:bg-surface-subtle");
    expect(screen.getByLabelText("Name")).toHaveClass("autofill:shadow-[inset_0_0_0_1000px_var(--color-card)]");
  });
});
