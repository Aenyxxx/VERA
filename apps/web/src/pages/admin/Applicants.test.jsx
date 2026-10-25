// Applicant Management list (S18; FR-ADM-02, TC-64): rows with the current application and HR status label,
// search and status filter in the URL and in the API query, server pager, empty/no-match/error states. Decision 39-4:
// the Account column (Active / Inactive, HR's reason) and Deactivate (reason required, the ongoing-application
// warning) / Activate for every applicant.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { list: vi.fn(), patch: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
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
  accountStatus: "active",
  deactivationReason: null,
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
  accountStatus: "active",
  deactivationReason: null,
};
// decision 39-4: an inactive applicant (reason shown) and a Deployed one (hired is not ongoing)
const CORA = { ...BEN, applicantId: "p3", applicantName: "Cora Lim", email: "cora@vera.test", accountStatus: "inactive", deactivationReason: "Asked to be removed." };
const DAN = { ...ANA, applicantId: "p4", applicantName: "Dan Uy", email: "dan@vera.test", applicationId: "a4", status: "hired", jobTitle: "Store Crew" };
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
      ["hired", "Deployed"], // decision 37C: the label reads Deployed; the value stays hired
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

describe("decision 39-4: account status on Applicant Management (every applicant; moved from the Applicant Pool)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [ANA, BEN, CORA, DAN];
    api.list.mockImplementation(async () => ({ data: rows, meta: { page: 1, pageSize: 20, total: rows.length } }));
  });

  it("an Account column: Active with Deactivate, or Inactive with HR's reason and Activate", async () => {
    renderAt();
    const ana = (await screen.findByText("Ana Cruz")).closest("tr");
    const table = ana.closest("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Applicant", "Current application", "Status", "Last update", "Account",
    ]);
    expect(within(ana).getAllByRole("cell").at(-1).textContent).toBe("ActiveDeactivate");
    expect(within(ana).getByRole("button", { name: "Deactivate Ana Cruz's account" })).toBeInTheDocument();
    const cora = screen.getByText("Cora Lim").closest("tr");
    expect(within(cora).getAllByRole("cell").at(-1).textContent).toBe("InactiveReason: Asked to be removed.Activate");
    expect(within(cora).queryByRole("button", { name: /Deactivate/ })).not.toBeInTheDocument();
  });

  it("Deactivate with an ongoing application: the warning, a required reason, the request by applicant, a 409 in the dialog, then the toast", async () => {
    const user = userEvent.setup();
    api.patch
      .mockRejectedValueOnce(new ApiError(409, "CONFLICT", "This applicant's application changed meanwhile. Refresh the page."))
      .mockResolvedValueOnce({ applicantId: "p1", accountStatus: "inactive", closedApplication: { applicationId: "a1", from: "endorsed" }, expiredOffers: 0, signInBlocked: true });
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Deactivate Ana Cruz's account" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate Ana Cruz's account?" });
    expect(
      within(dialog).getByText(
        "Ana Cruz will no longer be able to sign in to VERA. A pending job offer or invitation ends, and pool matching skips them until the account is active again.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("note")).toHaveTextContent(
      "Their application for Cashier will be closed (Application closed: no applicant pool entry, no company block). Its interviews and document requests are cancelled; if they are with the client, the endorsement is marked.",
    );
    expect(within(dialog).getByRole("note")).not.toHaveTextContent(/Kabayan/); // HR screen, but the note names the job only
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    expect(within(dialog).getByText("Write the reason (at least 5 characters).")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Reason"), "  Duplicate account.  ");
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/applicants/p1/account", { accountStatus: "inactive", reason: "Duplicate account." });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This applicant's application changed meanwhile.");
    expect(toast.success).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ana Cruz's account is inactive and their application was closed."));
  });

  it("Deactivate without an application: no warning; a Deployed applicant: the application stays; a failed ban warns", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValueOnce({ applicantId: "p2", accountStatus: "inactive", closedApplication: null, expiredOffers: 0, signInBlocked: true });
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Deactivate Ben Reyes's account" }));
    let dialog = await screen.findByRole("dialog", { name: "Deactivate Ben Reyes's account?" });
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Asked to be removed.");
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ben Reyes's account is inactive."));

    api.patch.mockResolvedValueOnce({ applicantId: "p4", accountStatus: "inactive", closedApplication: null, expiredOffers: 0, signInBlocked: false });
    await user.click(screen.getByRole("button", { name: "Deactivate Dan Uy's account" }));
    dialog = await screen.findByRole("dialog", { name: "Deactivate Dan Uy's account?" });
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument(); // hired (Deployed) is not ongoing (Q4-a)
    expect(within(dialog).getByText("Their Deployed application for Store Crew stays as it is.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Asked to be removed.");
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    expect(api.patch).toHaveBeenLastCalledWith("/admin/applicants/p4/account", { accountStatus: "inactive", reason: "Asked to be removed." });
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Dan Uy's account is inactive, but sign-in could not be blocked yet. Deactivate again to retry."),
    );
  });

  it("Activate needs no reason and sends accountStatus active", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ applicantId: "p3", accountStatus: "active", signInBlocked: false });
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Activate Cora Lim's account" }));
    const dialog = await screen.findByRole("dialog", { name: "Activate Cora Lim's account?" });
    expect(within(dialog).queryByLabelText("Reason")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/A closed application, and offers or invitations that ended, are not restored\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Activate account" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/applicants/p3/account", { accountStatus: "active" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cora Lim's account is active again."));
  });
});
