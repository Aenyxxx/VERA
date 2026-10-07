// Applicant Job Vacancies list + detail (FR-VAC-04, BR-16; TC-26).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { default: Jobs } = await import("./Jobs");
const { default: JobDetailPage } = await import("./JobDetailPage");

const CARD = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  summary: "Handles payments at the counter.",
  deploymentLocation: "Baliuag, Bulacan",
  employmentType: "Full-time",
  postedAt: "2026-10-07T01:00:00.000Z",
};
const JOB = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  jobDescription: "Handles payments at the counter.",
  keyResponsibilities: "Process payments\nIssue receipts",
  requiredSkills: "Cash handling\nPOS system operation",
  experienceRequirement: "Cashier\nBalance the cash drawer",
  minYearsExperience: 1,
  minEducationLevel: "senior_high",
  minHeightCm: 150,
  deploymentLocation: "Baliuag, Bulacan",
  employmentType: "Full-time",
  postedAt: "2026-10-07T01:00:00.000Z",
};

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/applicant/jobs", element: <Jobs /> },
      { path: "/applicant/jobs/:vacancyId", element: <JobDetailPage /> },
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

describe("Job Vacancies (applicant)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists open jobs as cards that link to the detail", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    renderAt("/applicant/jobs");

    expect(await screen.findByRole("heading", { name: "Cashier" })).toBeInTheDocument();
    expect(screen.getByText("Handles payments at the counter.")).toBeInTheDocument();
    expect(screen.getByText("Baliuag, Bulacan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details: Cashier" })).toHaveAttribute("href", "/applicant/jobs/v1");
  });

  it("searches by job title", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    const user = userEvent.setup();
    renderAt("/applicant/jobs");
    await screen.findByRole("heading", { name: "Cashier" });

    await user.type(screen.getByLabelText("Search job title"), "cash");
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("/applicant/vacancies?search=cash&pageSize=100"));
  });

  it("shows empty, no-match, and error states", async () => {
    api.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    const user = userEvent.setup();
    renderAt("/applicant/jobs");
    expect(await screen.findByText("No open jobs right now")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search job title"), "pilot");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    api.list.mockRejectedValue(new ApiError(500, "INTERNAL", "Something went wrong."));
    renderAt("/applicant/jobs");
    expect(await screen.findByText("Jobs could not be loaded")).toBeInTheDocument();
  });
});

describe("Job detail (applicant)", () => {
  // The detail page loads the job and the applicant's own applications (to show "Applied").
  const serve = (job, applications = []) =>
    api.get.mockImplementation(async (path) => (path === "/applicant/applications" ? applications : job));

  beforeEach(() => vi.clearAllMocks());

  it("shows the description, qualifications, and responsibilities", async () => {
    serve(JOB);
    renderAt("/applicant/jobs/v1");

    expect(await screen.findByRole("heading", { name: "Cashier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Cash handling")).toBeInTheDocument();
    expect(screen.getByText("At least 1 year of experience")).toBeInTheDocument();
    expect(screen.getByText("Education: Senior high school or higher")).toBeInTheDocument();
    expect(screen.getByText("Height: at least 150 cm")).toBeInTheDocument();
    expect(screen.getByText("Issue receipts")).toBeInTheDocument();
    expect(screen.getByText("Experience: Cashier")).toBeInTheDocument();
    expect(screen.getByText("Balance the cash drawer")).toBeInTheDocument();
  });

  it("never shows age, gender, or a company, even if the API sent them (TC-26, RA 10911)", async () => {
    serve({
      ...JOB,
      minAge: 18,
      maxAge: 35,
      genderRequirement: "female",
      companyName: "Kabayan Mart",
    });
    renderAt("/applicant/jobs/v1");
    await screen.findByRole("heading", { name: "Cashier", level: 1 });

    const page = document.body.textContent;
    expect(page).not.toMatch(/Kabayan Mart/);
    expect(page).not.toMatch(/\bage\b|18|35/i);
    expect(page).not.toMatch(/female|gender/i);
  });

  it("offers Apply when the applicant has not applied yet (FR-APP-02)", async () => {
    serve(JOB);
    renderAt("/applicant/jobs/v1");
    const apply = await screen.findByRole("button", { name: "Apply" });
    await waitFor(() => expect(apply).toBeEnabled()); // disabled while the applicant's applications load
  });

  it("TC-34 (UI): after applying, the button shows Applied and the current stage instead", async () => {
    serve(JOB, [{ applicationId: "a1", vacancyId: "v1", jobTitle: "Cashier", applicantType: "experienced", status: "waiting_pool" }]);
    renderAt("/applicant/jobs/v1");
    expect(await screen.findByRole("button", { name: "Applied" })).toBeDisabled();
    expect(screen.getByText("Application received")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("says when a job is no longer open", async () => {
    api.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "This job is no longer open."));
    renderAt("/applicant/jobs/v1");
    expect(await screen.findByText("This job is no longer open")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Job Vacancies" })).toHaveAttribute("href", "/applicant/jobs");
  });

  it("says when 'no experience' is required", async () => {
    serve({ ...JOB, minYearsExperience: 0, minHeightCm: null, minEducationLevel: null });
    renderAt("/applicant/jobs/v1");
    expect(await screen.findByText("No work experience required")).toBeInTheDocument();
    expect(screen.queryByText(/Height:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Education:/)).not.toBeInTheDocument();
  });
});
