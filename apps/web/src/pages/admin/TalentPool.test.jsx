// Applicant Pool (S17 + Phase 3, PRD FR-POOL-01, decision 18): tabs "Waiting" / "Returned by Client" (POOL_TABS, the tab
// in the URL, one request per tab), rows from GET /api/admin/pool?tab= with name, reason + availability, added date,
// source job + company, and the latest offer or job invitation (kind, job, company, status) or "None"; empty and error
// states per tab. Decision 37D: the search (name or email, ?q=) on both tabs and the Account column (Active / Inactive
// badge, HR's reason, Deactivate with a required reason / Activate). Decision 39-2: no Run rematch again (the
// automatic rematch after Not hired is the only one).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: TalentPool } = await import("./TalentPool");

const JUAN = {
  talentPoolId: "t1", poolReason: "not_hired", availability: "invited", addedAt: "2030-10-10T06:00:00.000Z", sourceApplicationId: "a1",
  applicantName: "Juan Dela Cruz", email: "juan@example.com", accountStatus: "active", deactivationReason: null,
  sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart",
  offerStatus: "pending", offerKind: "rematch_offer", offerJobTitle: "Store Crew", offerCompanyName: "ClayGo", offeredAt: "2030-10-10T06:01:00.000Z",
};
const ANA = {
  talentPoolId: "t2", poolReason: "prescreen_failed", availability: "invited", addedAt: "2030-10-09T02:00:00.000Z", sourceApplicationId: "a2",
  applicantName: "Ana Cruz", email: "ana@example.com", accountStatus: "active", deactivationReason: null,
  sourceJobTitle: "Store Crew", sourceCompanyName: "ClayGo",
  offerStatus: "pending", offerKind: "job_invitation", offerJobTitle: "Bagger", offerCompanyName: "Kabayan Mart", offeredAt: "2030-10-11T02:00:00.000Z",
};
const BEN = {
  talentPoolId: "t3", poolReason: "dropped", availability: "available", addedAt: "2030-10-08T02:00:00.000Z", sourceApplicationId: "a3",
  applicantName: "Ben Reyes", email: "ben@example.com", accountStatus: "active", deactivationReason: null,
  sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart",
  offerStatus: null, offerKind: null, offerJobTitle: null, offerCompanyName: null, offeredAt: null,
};
// Decision 37D: a deactivated account stays listed (availability 'unavailable'), with the reason and Activate.
const CORA = {
  talentPoolId: "t4", poolReason: "did_not_pass", availability: "unavailable", addedAt: "2030-10-07T02:00:00.000Z", sourceApplicationId: "a4",
  applicantName: "Cora Lim", email: "cora@example.com", accountStatus: "inactive", deactivationReason: "Asked to be removed.",
  sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart",
  offerStatus: "expired", offerKind: "job_invitation", offerJobTitle: "Bagger", offerCompanyName: "Kabayan Mart", offeredAt: "2030-10-08T02:00:00.000Z",
};
const DAN = { ...CORA, talentPoolId: "t5", poolReason: "training_failed", applicantName: "Dan Uy", email: "dan@example.com" };

function renderPage(path = "/admin/talent-pool") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: "/admin/talent-pool", element: <TalentPool /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (path) => (path.endsWith("tab=client") ? [JUAN] : [ANA, BEN]));
});

describe("Applicant Pool page", () => {
  it("opens on the Waiting tab: screening failures, drops, and standby, with the latest invitation", async () => {
    renderPage();
    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Applicant Pool", level: 1 });
    expect(heading).toBeInTheDocument();
    // decision 36: the page header has no description
    expect(heading.nextElementSibling).toBeNull();
    expect(screen.queryByText(/free to apply again/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Waiting", "Returned by Client"]);
    expect(screen.getByRole("tab", { name: "Waiting" })).toHaveAttribute("aria-selected", "true");
    const [header, ana, ben] = screen.getAllByRole("row");
    expect(within(header).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Applicant", "Reason", "Added", "From", "Latest offer or invitation", "Account",
    ]);
    // the initials disc is decorative (design 23): its text leads the cell but is hidden from screen readers
    expect(within(ana).getByText("AC")).toHaveAttribute("aria-hidden", "true");
    expect(within(ana).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "ACAna Cruzana@example.com",
      "Prescreen failedOffer or invitation pending",
      "Oct 9, 2030, 10:00 AM",
      "Store CrewClayGo",
      "Bagger at Kabayan MartJob invitationWaiting for the applicant",
      "ActiveDeactivate",
    ]);
    expect(within(ben).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "BRBen Reyesben@example.com", "DroppedAvailable", "Oct 8, 2030, 10:00 AM", "CashierKabayan Mart", "None", "ActiveDeactivate",
    ]);
    expect(api.get.mock.calls).toEqual([["/admin/pool?tab=waiting"]]);
  });

  it("Returned by Client: not hired / training failed, with the latest rematch offer", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Cruz");
    await user.click(screen.getByRole("tab", { name: "Returned by Client" }));
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
    const [, juan] = screen.getAllByRole("row");
    expect(within(juan).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "JDJuan Dela Cruzjuan@example.com",
      "Not hiredOffer or invitation pending",
      "Oct 10, 2030, 2:00 PM",
      "CashierKabayan Mart",
      "Store Crew at ClayGoRematch offerWaiting for the applicant",
      "ActiveDeactivate",
    ]);
    expect(screen.queryByText("Ana Cruz")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith("/admin/pool?tab=client");
  });

  it("?tab=client in the URL opens that tab; an unknown tab falls back to Waiting", async () => {
    renderPage("/admin/talent-pool?tab=client");
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Returned by Client" })).toHaveAttribute("aria-selected", "true");
  });

  it("an empty tab says so, per tab", async () => {
    api.get.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nobody is waiting")).toBeInTheDocument();
  });

  it("decision 36: the empty Returned by Client tab shows its title only; the Waiting tab keeps its line", async () => {
    api.get.mockResolvedValue([]);
    renderPage("/admin/talent-pool?tab=client");
    const empty = await screen.findByText("Nobody was returned by a client");
    expect(empty.nextElementSibling).toBeNull();
    expect(screen.queryByText(/when a client does not hire them/)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Waiting" }));
    const waiting = await screen.findByText("Nobody is waiting");
    expect(waiting.nextElementSibling).toHaveTextContent(/^Applicants appear here when an application ends before the client/);
  });

  it("a load error offers Try again", async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Something went wrong.")).mockResolvedValueOnce([BEN]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ben Reyes")).toBeInTheDocument();
  });
});

describe("decision 37D: search and account status", () => {
  it("the search sends q on the current tab, stays in the URL, and is kept when switching tabs", async () => {
    const user = userEvent.setup();
    const router = renderPage();
    await screen.findByText("Ana Cruz");
    await user.type(screen.getByRole("searchbox", { name: "Search name or email" }), "cora@");
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/admin/pool?tab=waiting&q=cora%40"));
    expect(router.state.location.search).toBe("?q=cora%40");
    await user.click(screen.getByRole("tab", { name: "Returned by Client" }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/admin/pool?tab=client&q=cora%40"));
    expect(new URLSearchParams(router.state.location.search).get("q")).toBe("cora@");
    expect(screen.getByRole("searchbox", { name: "Search name or email" })).toHaveValue("cora@");
  });

  it("inactive accounts are listed on both tabs, found by the search, with the Inactive badge, the reason, and Activate", async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path) => (path.includes("tab=client") ? [DAN] : [CORA, BEN]));
    renderPage("/admin/talent-pool?q=example");
    const cora = (await screen.findByText("Cora Lim")).closest("tr");
    expect(api.get).toHaveBeenCalledWith("/admin/pool?tab=waiting&q=example");
    expect(within(cora).getAllByRole("cell").at(-1).textContent).toBe("InactiveReason: Asked to be removed.Activate");
    expect(within(cora).getByText("Unavailable")).toBeInTheDocument();
    expect(within(cora).getByRole("button", { name: "Activate Cora Lim's account" })).toBeInTheDocument();
    expect(within(cora).queryByRole("button", { name: /Deactivate/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Returned by Client" }));
    const dan = (await screen.findByText("Dan Uy")).closest("tr");
    expect(api.get).toHaveBeenLastCalledWith("/admin/pool?tab=client&q=example");
    expect(within(dan).getAllByRole("cell").at(-1).textContent).toBe("InactiveReason: Asked to be removed.Activate");
  });

  it("a search with no result says so", async () => {
    api.get.mockResolvedValue([]);
    renderPage("/admin/talent-pool?q=nobody");
    expect(await screen.findByText("No applicant matches this search")).toBeInTheDocument();
  });

  it("Deactivate requires a reason, states the consequence, and sends it; a 409 stays in the dialog", async () => {
    const user = userEvent.setup();
    api.patch
      .mockRejectedValueOnce(new ApiError(409, "CONFLICT", "This applicant has an ongoing or hired application. Refresh the page."))
      .mockResolvedValueOnce({ talentPoolId: "t3", accountStatus: "inactive", expiredOffers: 0, signInBlocked: true });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Deactivate Ben Reyes's account" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate Ben Reyes's account?" });
    expect(
      within(dialog).getByText(
        "Ben Reyes will no longer be able to sign in to VERA. A pending job offer or invitation ends, and pool matching skips them until the account is active again.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    expect(within(dialog).getByText("Write the reason (at least 5 characters).")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Reason"), "  Duplicate account.  ");
    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/pool/t3/account", { accountStatus: "inactive", reason: "Duplicate account." });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This applicant has an ongoing or hired application.");
    expect(toast.success).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Deactivate account" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ben Reyes's account is inactive."));
  });

  it("decision 39-2: no rematch button on any row (the automatic rematch after Not hired is the only one)", async () => {
    // the entries that showed Run rematch again before (not hired, no pending or accepted offer, active account)
    const EXPIRED = { ...JUAN, talentPoolId: "t6", applicantName: "Eve Tan", email: "eve@example.com", sourceApplicationId: "a6", offerStatus: "expired" };
    const NONE = { ...JUAN, talentPoolId: "t7", applicantName: "Fay Go", email: "fay@example.com", sourceApplicationId: "a7", offerStatus: null, offerKind: null, offerJobTitle: null, offerCompanyName: null };
    const ACCEPTED = { ...JUAN, talentPoolId: "t8", applicantName: "Gil Ong", email: "gil@example.com", offerStatus: "accepted" };
    const TRAINING = { ...NONE, talentPoolId: "t10", applicantName: "Ivy Lo", email: "ivy@example.com", poolReason: "training_failed" };
    api.get.mockResolvedValue([JUAN, EXPIRED, NONE, ACCEPTED, TRAINING]);
    renderPage("/admin/talent-pool?tab=client");
    await screen.findByText("Juan Dela Cruz");
    expect(screen.queryAllByRole("button", { name: /rematch/i })).toEqual([]);
    expect(screen.queryByText(/Run rematch again/)).not.toBeInTheDocument();
    // the offer cell keeps only the latest offer or "None"
    const fay = screen.getByText("Fay Go").closest("tr");
    expect(within(fay).getAllByRole("cell")[4].textContent).toBe("None");
    const eve = screen.getByText("Eve Tan").closest("tr");
    expect(within(eve).getAllByRole("cell")[4].textContent).toBe("Store Crew at ClayGoRematch offerExpired (no longer available)");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("Activate needs no reason and sends accountStatus active", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue([CORA]);
    api.patch.mockResolvedValue({ talentPoolId: "t4", accountStatus: "active", signInBlocked: false });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Activate Cora Lim's account" }));
    const dialog = await screen.findByRole("dialog", { name: "Activate Cora Lim's account?" });
    expect(within(dialog).queryByLabelText("Reason")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Activate account" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/pool/t4/account", { accountStatus: "active" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cora Lim's account is active again."));
  });
});
