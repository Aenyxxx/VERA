// Dashboard status panel (PRD FR-PROF-08, APP_FLOW §3.5 / §6 labels).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { StatusPanel } = await import("./StatusPanel");

const row = (overrides) => ({
  applicationId: "a1",
  vacancyId: "v1",
  jobTitle: "Cashier",
  applicantType: "experienced",
  status: "waiting_pool",
  appliedAt: "2026-10-10T00:30:00.000Z",
  statusChangedAt: "2026-10-10T00:30:00.000Z",
  actionDueAt: null,
  ...overrides,
});

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StatusPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StatusPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows each application with type, applied date (Manila time), and the applicant stage label", async () => {
    api.get.mockResolvedValue([
      row(),
      row({ applicationId: "a2", vacancyId: "v2", jobTitle: "Store Crew", applicantType: "first_time", status: "prescreen_failed" }),
    ]);
    renderPanel();

    expect(await screen.findByRole("heading", { name: "My applications" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/applicant/applications");
    expect(screen.getByText("Cashier")).toBeInTheDocument();
    expect(screen.getByText("Experienced · Applied Oct 10, 2026, 8:30 AM")).toBeInTheDocument();
    expect(screen.getByText("Application received")).toBeInTheDocument();
    expect(screen.getByText("Store Crew")).toBeInTheDocument();
    expect(screen.getByText("Not qualified")).toBeInTheDocument();
    // waiting_pool has no next action; every final status except hired says the applicant may apply elsewhere (BR-18)
    expect(screen.getAllByText(/Next:/)).toHaveLength(1);
    expect(screen.getByText(/You can apply to other jobs/)).toBeInTheDocument();
  });

  it("shortlisted without a pending request: 'Wait for the agency to review your application'", async () => {
    api.get.mockResolvedValue([row({ status: "shortlisted", nextDueAt: null })]);
    renderPanel();

    expect(await screen.findByText("Under review")).toBeInTheDocument();
    expect(screen.getByText(/Wait for the agency to review your application/)).toBeInTheDocument();
    expect(screen.queryByText(/Upload requested documents/)).not.toBeInTheDocument();
  });

  it("shortlisted with a pending request: 'Upload requested documents' with its deadline (FR-DOC-03)", async () => {
    api.get.mockResolvedValue([row({ status: "shortlisted", nextDueAt: "2026-10-11T04:00:00.000Z" })]);
    renderPanel();

    expect(await screen.findByText(/Upload requested documents — due Oct 11, 2026, 12:00 PM \(Philippine time\)/)).toBeInTheDocument();
  });

  it("shows the empty state with a link to the jobs", async () => {
    api.get.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse job vacancies" })).toHaveAttribute("href", "/applicant/jobs");
  });

  it("shows an error state with retry", async () => {
    api.get.mockRejectedValue(new ApiError(500, "INTERNAL", "Something went wrong."));
    renderPanel();
    expect(await screen.findByText("Your applications could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
