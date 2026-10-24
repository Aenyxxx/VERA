// Recruitment Reports placeholder (decision 34): HR and admin nav item (last), sample tiles, the pipeline and
// hiring-outcome charts, the vacancy performance table, and no API call. Owner change Oct 20: no "Preview: sample data"
// banner and no "Coming soon"; Export PDF / Export Excel are enabled but do nothing.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), download: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { api } = await import("@/lib/apiClient");
const { toast } = await import("sonner");

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}
const { ADMIN_NAV, navFor } = await import("@/layouts/navigation");
const { routes } = await import("@/app/routes");
const { default: Reports } = await import("./Reports");

function renderPage() {
  render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Recruitment Reports (decision 34)", () => {
  it("is the last sidebar item for HR and for admin, at /admin/reports, inside the staff area", () => {
    for (const role of ["hr", "admin"]) {
      const nav = navFor(ADMIN_NAV, role);
      expect(nav.at(-1)).toMatchObject({ label: "Recruitment Reports", to: "/admin/reports" });
      expect(nav.filter((i) => i.to === "/admin/reports")).toHaveLength(1);
    }
    expect(navFor(ADMIN_NAV, "hr").at(-2).label).toBe("Applicant Pool");
    expect(navFor(ADMIN_NAV, "admin").at(-2).label).toBe("User Management");

    // the route sits under the staff guard (RequireRole STAFF_ROLES → AdminLayout), not the applicant area
    const paths = [];
    const walk = (list, staff) =>
      list.forEach((r) => {
        const isStaff = staff || (r.element?.props?.roles ?? []).includes("hr");
        if (r.path) paths.push([r.path, isStaff]);
        if (r.children) walk(r.children, isStaff);
      });
    walk(routes, false);
    expect(paths.filter(([p]) => p === "/admin/reports")).toEqual([["/admin/reports", true]]);
  });

  it("shows the sample tiles, both charts, and the vacancy table; no banner, no 'Coming soon'; no API call", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Recruitment Reports", level: 1 })).toBeInTheDocument();
    const tiles = screen.getByRole("region", { name: "Totals (sample)" });
    for (const [label, value] of [["Total applications", "248"], ["Active vacancies", "5"], ["Endorsed", "22"], ["Deployed", "14"]]) {
      expect(within(tiles).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(within(tiles).queryByText("Hired")).not.toBeInTheDocument(); // decision 37C: hired = Deployed
    // owner change Oct 20 (after the positive checks above on the same page): no banner and no "Coming soon"
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText(/Preview: sample data/i)).toBeNull();
    expect(screen.queryByText(/not VERA's records/i)).toBeNull();
    expect(screen.queryByText(/Coming soon/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Preview: sample data|Coming soon/i);
    // decision 36: no page description
    expect(screen.queryByText("Pipeline, hiring outcomes, and vacancy performance.")).not.toBeInTheDocument();

    const pipeline = screen.getByRole("figure", { name: "Applicant progress" });
    expect(screen.queryByRole("figure", { name: "Recruitment pipeline" })).not.toBeInTheDocument();
    const bars = within(pipeline).getAllByRole("img");
    expect(bars.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Applications: 248 applications, 100% of all applications",
      "Qualified: 196 applications, 79% of all applications",
      "Shortlisted: 64 applications, 26% of all applications",
      "Interviewed: 48 applications, 19% of all applications",
      "Passed: 31 applications, 13% of all applications",
      "Endorsed: 22 applications, 9% of all applications",
      "Deployed: 14 applications, 6% of all applications",
    ]);
    expect(bars[0].style.width).toBe("85%"); // the largest bar; the others scale from it
    expect(bars[6].style.width).toBe(`${(14 / 248) * 85}%`);

    const outcomes = screen.getByRole("figure", { name: "Hiring outcomes" });
    expect(within(outcomes).getAllByRole("img").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Deployed: 14 of 22 (64%)",
      "Not hired: 5 of 22 (23%)",
      "Still with the client: 3 of 22 (14%)",
    ]);
    const legend = within(outcomes).getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Deployed14(64%)",
      "Not hired5(23%)",
      "Still with the client3(14%)",
    ]);
    // decision 36 (after the chart checks above): no "What happened to the 22 endorsed applicants." line
    expect(within(outcomes).queryByText(/What happened to the/)).not.toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Vacancy", "Company", "Applications", "Shortlisted", "Endorsed", "Deployed", "Fill rate",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Store Crew", "Sample Food Corp.", "82", "20", "7", "5 of 6", "83%",
    ]);

    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.download).not.toHaveBeenCalled();
  });

  it("the sample numbers agree: the table adds up to the tiles, the pipeline, and the outcomes", async () => {
    const { SAMPLE_OUTCOMES, SAMPLE_PIPELINE, SAMPLE_TILES, SAMPLE_VACANCIES } = await import("@/features/reports/sampleData");
    const sum = (key) => SAMPLE_VACANCIES.reduce((s, v) => s + v[key], 0);
    const tile = (label) => SAMPLE_TILES.find((t) => t.label === label).value;
    const stage = (name) => SAMPLE_PIPELINE.find((s) => s.stage === name).value;
    expect(sum("applications")).toBe(tile("Total applications"));
    expect(sum("applications")).toBe(stage("Applications"));
    expect(sum("shortlisted")).toBe(stage("Shortlisted"));
    expect(sum("endorsed")).toBe(tile("Endorsed"));
    expect(sum("hired")).toBe(tile("Deployed"));
    expect(sum("hired")).toBe(stage("Deployed"));
    expect(SAMPLE_OUTCOMES.reduce((s, o) => s + o.value, 0)).toBe(stage("Endorsed"));
    expect(SAMPLE_VACANCIES).toHaveLength(tile("Active vacancies"));
    for (let i = 1; i < SAMPLE_PIPELINE.length; i++) expect(SAMPLE_PIPELINE[i].value).toBeLessThanOrEqual(SAMPLE_PIPELINE[i - 1].value);
    expect(SAMPLE_VACANCIES.every((v) => v.company.startsWith("Sample "))).toBe(true); // never a real client
  });

  it("owner change: Export PDF and Export Excel are enabled, and a click sends no request and changes nothing", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    URL.createObjectURL = vi.fn(() => "blob:x");
    render(
      <MemoryRouter initialEntries={["/admin/reports"]}>
        <Routes>
          <Route path="/admin/reports" element={<><Reports /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Recruitment Reports", level: 1 })).toBeInTheDocument();
    for (const name of ["Export PDF", "Export Excel"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toHaveAttribute("aria-describedby");
      const before = document.body.innerHTML;
      await user.click(button);
      expect(document.body.innerHTML).toBe(before); // nothing appears, moves, or changes (no toast, no dialog)
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/reports"); // no navigation
    }
    for (const call of [api.get, api.post, api.patch, api.download, fetchSpy, openSpy, URL.createObjectURL]) {
      expect(call).not.toHaveBeenCalled();
    }
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    openSpy.mockRestore();
  });

  it("every chart mark has a hover / focus tooltip with its value, and can be reached with the keyboard", () => {
    renderPage();
    const pipeline = screen.getByRole("figure", { name: "Applicant progress" });
    const tips = within(pipeline).getAllByRole("tooltip", { hidden: true });
    expect(tips).toHaveLength(7);
    expect(tips[1]).toHaveTextContent("79% of all applications reached Qualified");
    for (const bar of within(pipeline).getAllByRole("img")) expect(bar).toHaveAttribute("tabindex", "0");

    const outcomes = screen.getByRole("figure", { name: "Hiring outcomes" });
    expect(within(outcomes).getAllByRole("tooltip", { hidden: true }).map((t) => t.textContent)).toEqual([
      "14 (64%) Deployed",
      "5 (23%) Not hired",
      "3 (14%) Still with the client",
    ]);
  });
});
