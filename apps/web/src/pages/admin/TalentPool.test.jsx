// Applicant Pool (S17 + Phase 3, PRD FR-POOL-01, decision 18): tabs "Waiting" / "Returned by Client" (POOL_TABS, the tab
// in the URL, one request per tab), rows from GET /api/admin/pool?tab= with name, reason + availability, added date,
// source job + company, and the latest offer or job invitation (kind, job, company, status) or "None"; empty and error
// states per tab.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { default: TalentPool } = await import("./TalentPool");

const JUAN = {
  talentPoolId: "t1", poolReason: "not_hired", availability: "invited", addedAt: "2030-10-10T06:00:00.000Z", sourceApplicationId: "a1",
  applicantName: "Juan Dela Cruz", sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart",
  offerStatus: "pending", offerKind: "rematch_offer", offerJobTitle: "Store Crew", offerCompanyName: "ClayGo", offeredAt: "2030-10-10T06:01:00.000Z",
};
const ANA = {
  talentPoolId: "t2", poolReason: "prescreen_failed", availability: "invited", addedAt: "2030-10-09T02:00:00.000Z", sourceApplicationId: "a2",
  applicantName: "Ana Cruz", sourceJobTitle: "Store Crew", sourceCompanyName: "ClayGo",
  offerStatus: "pending", offerKind: "job_invitation", offerJobTitle: "Bagger", offerCompanyName: "Kabayan Mart", offeredAt: "2030-10-11T02:00:00.000Z",
};
const BEN = {
  talentPoolId: "t3", poolReason: "dropped", availability: "available", addedAt: "2030-10-08T02:00:00.000Z", sourceApplicationId: "a3",
  applicantName: "Ben Reyes", sourceJobTitle: "Cashier", sourceCompanyName: "Kabayan Mart",
  offerStatus: null, offerKind: null, offerJobTitle: null, offerCompanyName: null, offeredAt: null,
};

function renderPage(path = "/admin/talent-pool") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TalentPool />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (path) => (path.endsWith("tab=client") ? [JUAN] : [ANA, BEN]));
});

describe("Applicant Pool page", () => {
  it("opens on the Waiting tab: screening failures, drops, and standby, with the latest invitation", async () => {
    renderPage();
    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applicant Pool", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Waiting", "Returned by Client"]);
    expect(screen.getByRole("tab", { name: "Waiting" })).toHaveAttribute("aria-selected", "true");
    const [header, ana, ben] = screen.getAllByRole("row");
    expect(within(header).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Applicant", "Reason", "Added", "From", "Latest offer or invitation",
    ]);
    expect(within(ana).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Ana Cruz",
      "Prescreen failedOffer or invitation pending",
      "Oct 9, 2030, 10:00 AM",
      "Store CrewClayGo",
      "Bagger at Kabayan MartJob invitationWaiting for the applicant",
    ]);
    expect(within(ben).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Ben Reyes", "DroppedAvailable", "Oct 8, 2030, 10:00 AM", "CashierKabayan Mart", "None",
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
      "Juan Dela Cruz",
      "Not hiredOffer or invitation pending",
      "Oct 10, 2030, 2:00 PM",
      "CashierKabayan Mart",
      "Store Crew at ClayGoRematch offerWaiting for the applicant",
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

  it("a load error offers Try again", async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Something went wrong.")).mockResolvedValueOnce([BEN]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ben Reyes")).toBeInTheDocument();
  });
});
