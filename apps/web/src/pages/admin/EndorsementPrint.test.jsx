// Printable endorsement (S16; FR-END-05 simplified): vacancy, client, candidate table in rank order with scores, one
// profile section per candidate, and the Print button.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { default: EndorsementPrint } = await import("./EndorsementPrint");

const candidate = (overrides) => ({
  itemId: "i1", applicationId: "a1", rank: 1, outcome: "pending", applicantType: "experienced", fullName: "Ana M. Cruz",
  email: "ana@example.com", contactNumber: "09170000000", age: 24, gender: "female", educationLevel: "senior_high",
  address: "1 Rizal St, Baliuag, Bulacan", matchedSkills: ["Handling cash", "Customer service"],
  matchingScore: 79.31, interviewScore: 77.5, finalScore: 78.41, overallRating: 4, ...overrides,
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/admin/endorsements/:vacancyId/print/:endorsementId", element: <EndorsementPrint /> }],
    { initialEntries: ["/admin/endorsements/v1/print/e1"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({
    endorsementId: "e1",
    sentAt: "2030-10-10T06:00:00.000Z",
    sentBy: "Maria Santos",
    vacancy: { vacancyId: "v1", jobTitle: "Cashier", deploymentLocation: "Baliuag, Bulacan", employmentType: "Full-time", slotsNeeded: 2 },
    company: { companyName: "Kabayan Mart", contactPersonName: "Kabayan Mart HR Officer", contactEmail: "hr@kabayanmart.example" },
    candidates: [candidate(), candidate({ itemId: "i2", applicationId: "a2", rank: 2, fullName: "Ben Reyes", applicantType: "first_time", finalScore: 76, matchedSkills: [] })],
  });
});

describe("Printable endorsement", () => {
  it("renders the vacancy, the client, the candidate table in rank order, and a profile per candidate", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Endorsement of candidates" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/admin/endorsements/print/e1");
    expect(screen.getByText("Sent Oct 10, 2030, 2:00 PM (Philippine time) by Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Kabayan Mart")).toBeInTheDocument();
    expect(screen.getByText("hr@kabayanmart.example")).toBeInTheDocument();
    expect(screen.getByText("Baliuag, Bulacan")).toBeInTheDocument();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").slice(0, 3).map((c) => c.textContent))).toEqual([
      ["1", "Ana M. Cruz", "Experienced"],
      ["2", "Ben Reyes", "First-time"],
    ]);
    expect(within(rows[0]).getByText("78.41%")).toBeInTheDocument();
    expect(within(rows[0]).getByText("4 — Good")).toBeInTheDocument();

    const ana = screen.getByRole("region", { name: "Profile of Ana M. Cruz" });
    expect(within(ana).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(ana).getByText("Senior high school")).toBeInTheDocument();
    expect(within(ana).getByText("1 Rizal St, Baliuag, Bulacan")).toBeInTheDocument();
    expect(within(ana).getByText(/Handling cash, Customer service/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Profile of Ben Reyes" })).toBeInTheDocument();
  });

  it("the Print button opens the browser's print dialog", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Print / Save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("an unknown endorsement shows the not-found state with the way back", async () => {
    api.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Endorsement not found."));
    renderPage();
    expect(await screen.findByText("Endorsement not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Endorsement Management" })).toHaveAttribute("href", "/admin/endorsements/v1");
  });
});
