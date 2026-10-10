// Applicant Pool (S17, PRD FR-POOL-01 minimal): rows from GET /api/admin/pool with name, reason + availability, added
// date, source job + company, and the latest rematch offer (job, company, status) or "No offer"; empty and error states.
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
  offerStatus: "pending", offerJobTitle: "Store Crew", offerCompanyName: "ClayGo", offeredAt: "2030-10-10T06:01:00.000Z",
};
const ANA = {
  talentPoolId: "t2", poolReason: "did_not_pass", availability: "available", addedAt: "2030-10-09T02:00:00.000Z", sourceApplicationId: "a2",
  applicantName: "Ana Cruz", sourceJobTitle: "Store Crew", sourceCompanyName: "ClayGo",
  offerStatus: null, offerJobTitle: null, offerCompanyName: null, offeredAt: null,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TalentPool />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Applicant Pool page", () => {
  it("lists each pool entry with reason, added date, source job + company, and the latest offer", async () => {
    api.get.mockResolvedValue([JUAN, ANA]);
    renderPage();
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applicant Pool", level: 1 })).toBeInTheDocument();
    const [header, juan, ana] = screen.getAllByRole("row");
    expect(within(header).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Applicant", "Reason", "Added", "From", "Latest rematch offer",
    ]);
    expect(within(juan).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Juan Dela Cruz",
      "Not hiredOffer pending",
      "Oct 10, 2030, 2:00 PM",
      "CashierKabayan Mart",
      "Store Crew at ClayGoWaiting for the applicant",
    ]);
    expect(within(ana).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Ana Cruz",
      "Did not passAvailable",
      "Oct 9, 2030, 10:00 AM",
      "Store CrewClayGo",
      "No offer",
    ]);
    expect(api.get).toHaveBeenCalledWith("/admin/pool");
  });

  it("an empty pool says so", async () => {
    api.get.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("The applicant pool is empty")).toBeInTheDocument();
  });

  it("a load error offers Try again", async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Something went wrong.")).mockResolvedValueOnce([ANA]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
  });
});
