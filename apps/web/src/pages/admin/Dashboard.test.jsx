// HR Dashboard (S18; FR-ADM-01, TC-63): 8 tiles in order with values and links to the filtered lists,
// upcoming interviews in Philippine time, loading/empty/error states.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

const { api } = await import("@/lib/apiClient");
const { default: Dashboard } = await import("./Dashboard");

const VALUES = {
  applicants: 12,
  waitingPool: 3,
  forScreening: 4,
  forInterview: 2,
  forEndorsement: 5,
  hired: 1,
  applicantPool: 0,
  activeVacancies: 2,
};
// The API sends the tiles in its own order; the page shows DASHBOARD_TILE_ORDER.
const TILES = Object.entries(VALUES)
  .reverse()
  .map(([key, value]) => ({ key, label: `API ${key}`, value }));

const INTERVIEWS = [
  {
    interviewId: "i1",
    applicationId: "a1",
    status: "confirmed",
    scheduledAt: "2030-10-12T02:00:00Z",
    durationMinutes: 30,
    applicantName: "Ana Cruz",
    vacancyId: "v1",
    jobTitle: "Cashier",
    companyName: "Kabayan Mart",
    interviewerName: "Maria Santos",
  },
  {
    interviewId: "i2",
    applicationId: "a2",
    status: "pending_confirmation",
    scheduledAt: "2030-10-12T06:30:00Z",
    durationMinutes: 30,
    applicantName: "Ben Reyes",
    vacancyId: "v2",
    jobTitle: "Store Crew",
    companyName: "ClayGo",
    interviewerName: null,
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/admin", element: <Dashboard /> }], { initialEntries: ["/admin"] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HR Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ tiles: TILES, upcomingInterviews: INTERVIEWS });
  });

  it("shows the 8 tiles in order with their values, each linking to its list", async () => {
    renderPage();
    const totals = await screen.findByRole("region", { name: "Totals" });
    const tiles = await within(totals).findAllByRole("link"); // the region holds skeletons until the data arrives
    expect(tiles.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Total applicants12", "/admin/applicants"],
      ["Waiting pool3", "/admin/applicants?status=waitingPool"],
      ["For screening4", "/admin/applicants?status=forScreening"],
      ["For interview2", "/admin/applicants?status=forInterview"],
      ["For endorsement5", "/admin/applicants?status=forEndorsement"],
      ["Hired1", "/admin/applicants?status=hired"],
      ["Applicant pool0", "/admin/applicants?status=applicantPool"],
      ["Active vacancies2", "/admin/vacancies"],
    ]);
    expect(api.get).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("lists upcoming interviews with job, company, Philippine time, status, and interviewer", async () => {
    renderPage();
    const ana = (await screen.findByText("Ana Cruz")).closest("tr");
    expect(ana).toHaveTextContent("Ana CruzCashierKabayan MartOct 12, 2030, 10:00 AMScheduledMaria Santos");
    const ben = screen.getByText("Ben Reyes").closest("tr");
    expect(ben).toHaveTextContent("Ben ReyesStore CrewClayGoOct 12, 2030, 2:30 PMAwaiting confirmationNot set");
    expect(screen.getByRole("columnheader", { name: "Interview (Philippine time)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All interviews" })).toHaveAttribute("href", "/admin/interviews");
  });

  it("shows the tiles and an empty state when no interview is coming up", async () => {
    api.get.mockResolvedValue({ tiles: TILES, upcomingInterviews: [] });
    renderPage();
    const totals = await screen.findByRole("region", { name: "Totals" });
    expect(await within(totals).findAllByRole("link")).toHaveLength(8);
    expect(screen.getByText("No upcoming interviews")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with Try again, which loads the dashboard", async () => {
    api.get.mockRejectedValueOnce(new Error("Network down"));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("The dashboard could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Totals" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    const totals = await screen.findByRole("region", { name: "Totals" });
    expect(await within(totals).findAllByRole("link")).toHaveLength(8);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
