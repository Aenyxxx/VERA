// Vacancy list + detail: cards, publish (TC-25), reopen at cap (FR-VAC-07).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Vacancies } = await import("./Vacancies");
const { default: VacancyDetail } = await import("./VacancyDetail");

const CARD = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  status: "open",
  slotsNeeded: 2,
  remainingSlots: 1,
  counts: { total: 9, screening: 4, interview: 2, passed: 1, hired: 1 },
};
const DETAIL = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  status: "draft",
  jobDescription: "Handles payments.",
  keyResponsibilities: "Process payments",
  requiredSkills: "Cash handling",
  experienceRequirement: null,
  minYearsExperience: 1,
  minAge: 18,
  maxAge: 35,
  genderRequirement: "any",
  minEducationLevel: "senior_high",
  minHeightCm: null,
  deploymentLocation: "Baliuag",
  employmentType: "Full-time",
  slotsNeeded: 2,
  shortlistPerGroup: 4,
  applicationCap: 16,
  applicationCount: 0,
  endorsementCount: 3,
  matchingThreshold: 40,
  passingScore: 75,
  postedAt: null,
  competencies: [
    { competencyId: "c1", competencyName: "Communication", weight: 30 },
    { competencyId: "c2", competencyName: "Technical Skills", weight: 40 },
    { competencyId: "c3", competencyName: "Adaptability", weight: 30 },
  ],
  weightTotal: 100,
  editable: { full: true, postingText: false, capIncrease: false },
};

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/vacancies", element: <Vacancies /> },
      { path: "/admin/vacancies/:id", element: <VacancyDetail /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("Job Vacancies list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows cards with company, status, remaining slots, and stage counts (FR-VAC-05)", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    renderAt("/admin/vacancies");

    const card = (await screen.findByRole("heading", { name: "Cashier" })).closest("a");
    expect(card).toHaveAttribute("href", "/admin/vacancies/v1");
    expect(within(card).getByText("Kabayan Mart")).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
    expect(card).toHaveTextContent("1 of 2 slots remaining");
    expect(card).toHaveTextContent("9Applicants");
  });

  it("searches by title or company and filters by status", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    const user = userEvent.setup();
    renderAt("/admin/vacancies");
    await screen.findByRole("heading", { name: "Cashier" });

    await user.type(screen.getByLabelText("Search title or company"), "kaba");
    await user.selectOptions(screen.getByLabelText("Status"), "open");

    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith("/admin/vacancies?search=kaba&pageSize=100&status=open"),
    );
  });

  it("shows an empty state with Create job vacancy", async () => {
    api.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    renderAt("/admin/vacancies");
    expect(await screen.findByText("No vacancies yet")).toBeInTheDocument();
  });
});

describe("Vacancy detail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes a draft after confirmation (TC-25)", async () => {
    const published = { ...DETAIL, status: "open", editable: { full: false, postingText: true, capIncrease: true } };
    let current = DETAIL; // the API returns the new status once published
    api.get.mockImplementation(async () => current);
    api.post.mockImplementation(async () => {
      current = published;
      return published;
    });
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");

    expect(await screen.findByRole("heading", { name: "Cashier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Publish Cashier?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/publish", {}));
    expect(toast.success).toHaveBeenCalledWith("Vacancy published");
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("asks for a higher cap to reopen a vacancy at its cap (FR-VAC-07)", async () => {
    api.get.mockResolvedValue({
      ...DETAIL,
      status: "closed",
      applicationCount: 16,
      editable: { full: false, postingText: true, capIncrease: true },
    });
    api.post.mockResolvedValue({ ...DETAIL, status: "open", applicationCap: 20 });
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");

    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Raise the application cap to reopen/)).toBeInTheDocument();

    const cap = within(dialog).getByLabelText("New application cap");
    await user.clear(cap);
    await user.type(cap, "16");
    await user.click(within(dialog).getByRole("button", { name: "Raise cap and reopen" }));
    expect(within(dialog).getByText("Use more than 16 (the applications so far)")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(cap);
    await user.type(cap, "20");
    await user.click(within(dialog).getByRole("button", { name: "Raise cap and reopen" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/reopen", { applicationCap: 20 }));
  });

  it("shows the ranking placeholder tab", async () => {
    api.get.mockResolvedValue(DETAIL);
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");
    await user.click(await screen.findByRole("tab", { name: "Ranking" }));
    expect(screen.getByText("No ranking yet")).toBeInTheDocument();
  });
});
