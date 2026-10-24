// Applicant Management list (S18; FR-ADM-02, TC-64): rows with the current application and HR status label,
// search and status filter in the URL and in the API query, server pager, empty/no-match/error states.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { list: vi.fn() },
}));

const { api } = await import("@/lib/apiClient");
const { default: Applicants } = await import("./Applicants");

const ANA = {
  applicantId: "p1",
  applicantName: "Ana Cruz",
  email: "ana@vera.test",
  applicationId: "a1",
  status: "endorsed",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  lastUpdate: "2030-10-12T02:00:00Z",
};
const BEN = {
  applicantId: "p2",
  applicantName: "Ben Reyes",
  email: "ben@vera.test",
  applicationId: null,
  status: null,
  jobTitle: null,
  companyName: null,
  lastUpdate: "2030-10-11T06:30:00Z",
};
const person = (n) => ({ ...BEN, applicantId: `x${n}`, applicantName: `Applicant ${n}`, email: `a${n}@vera.test` });

let rows;

function renderAt(path = "/admin/applicants") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/admin/applicants", element: <Applicants /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("Applicant Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [ANA, BEN];
    // The fake server: search by name, page by page and pageSize (the status filter is the API's job).
    api.list.mockImplementation(async (path) => {
      const query = new URL(path, "http://x").searchParams;
      const page = Number(query.get("page"));
      const pageSize = Number(query.get("pageSize"));
      const found = rows.filter((r) => r.applicantName.toLowerCase().includes(query.get("search").toLowerCase()));
      return { data: found.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: found.length } };
    });
  });

  it("lists applicants with email, current application, HR status label, and last update", async () => {
    renderAt();
    const ana = (await screen.findByText("Ana Cruz")).closest("tr");
    expect(ana).toHaveTextContent("ACAna Cruzana@vera.testCashierKabayan MartEndorsedOct 12, 2030, 10:00 AM");
    // the initials disc is decorative (design 12): its text leads the cell but is hidden from screen readers
    expect(within(ana).getByText("AC")).toHaveAttribute("aria-hidden", "true");
    const ben = screen.getByText("Ben Reyes").closest("tr");
    expect(ben).toHaveTextContent("BRBen Reyesben@vera.testNo applications yetOct 11, 2030, 2:30 PM");
    expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith("/admin/applicants?search=&page=1&pageSize=20");
    // decision 36: the page header has no description
    const heading = screen.getByRole("heading", { name: "Applicant Management", level: 1 });
    expect(heading.nextElementSibling).toBeNull();
    expect(screen.queryByText(/Every applicant with a confirmed profile/)).not.toBeInTheDocument();
  });

  it("opens with the tile's filter from the URL and sends it to the API", async () => {
    renderAt("/admin/applicants?status=forEndorsement");
    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("forEndorsement");
    expect(api.list).toHaveBeenCalledWith("/admin/applicants?search=&status=forEndorsement&page=1&pageSize=20");
  });

  it("ignores an unknown filter in the URL", async () => {
    renderAt("/admin/applicants?status=bogus");
    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(api.list).toHaveBeenCalledWith("/admin/applicants?search=&page=1&pageSize=20");
  });

  it("offers the tile filters by their dashboard labels", async () => {
    renderAt();
    await screen.findByText("Ana Cruz");
    const options = within(screen.getByLabelText("Status")).getAllByRole("option");
    expect(options.map((o) => [o.value, o.textContent])).toEqual([
      ["", "All applicants"],
      ["waitingPool", "Waiting pool"],
      ["forScreening", "For screening"],
      ["forInterview", "For interview"],
      ["forEndorsement", "For endorsement"],
      ["hired", "Hired"],
      ["applicantPool", "Applicant pool"],
    ]);
  });

  it("searches by name or email, keeps it in the URL, and starts again at page 1", async () => {
    const user = userEvent.setup();
    const router = renderAt("/admin/applicants?page=2");
    await waitFor(() => expect(api.list).toHaveBeenCalledWith("/admin/applicants?search=&page=2&pageSize=20"));

    await user.type(screen.getByLabelText("Search name or email"), "ana");

    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("/admin/applicants?search=ana&page=1&pageSize=20"));
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?search=ana");
  });

  it("filters by status and keeps it in the URL", async () => {
    const user = userEvent.setup();
    const router = renderAt();
    await screen.findByText("Ana Cruz");

    await user.selectOptions(screen.getByLabelText("Status"), "hired");

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("/admin/applicants?search=&status=hired&page=1&pageSize=20"));
    expect(router.state.location.search).toBe("?status=hired");
  });

  it("pages through the server list with Previous and Next", async () => {
    rows = Array.from({ length: 45 }, (_, i) => person(i + 1));
    const user = userEvent.setup();
    renderAt();

    expect(await screen.findByText("Showing 1–20 of 45")).toBeInTheDocument();
    expect(screen.getByText("Applicant 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing 21–40 of 45")).toBeInTheDocument();
    expect(screen.getByText("Applicant 21")).toBeInTheDocument();
    expect(api.list).toHaveBeenLastCalledWith("/admin/applicants?search=&page=2&pageSize=20");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing 41–45 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Showing 21–40 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("shows an empty state when nobody has signed up yet", async () => {
    rows = [];
    renderAt();
    expect(await screen.findByText("No applicants yet")).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it("shows a no-match state for a search with no results", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Ana Cruz");
    await user.type(screen.getByLabelText("Search name or email"), "zzz");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    api.list.mockRejectedValue(new Error("Network down"));
    renderAt();
    expect(await screen.findByText("This list could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });
});
