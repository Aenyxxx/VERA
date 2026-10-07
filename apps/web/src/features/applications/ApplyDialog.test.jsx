// Apply dialog (PRD FR-APP-02; TC-29, TC-30/32 UI side).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { ApplyDialog } = await import("./ApplyDialog");

const JOB = { vacancyId: "v1", jobTitle: "Cashier" };

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApplyDialog open onOpenChange={onOpenChange} job={JOB} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onOpenChange;
}

describe("ApplyDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for the applicant type only: no document selection", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Apply for Cashier" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "First-time job seeker" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Experienced" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/saved profile and current resume will be used/)).toBeInTheDocument();
  });

  it("TC-29: Submit application stays disabled until a type is chosen", async () => {
    const user = userEvent.setup();
    renderDialog();
    const submit = screen.getByRole("button", { name: "Submit application" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Experienced" }));
    expect(submit).toBeEnabled();
  });

  it("sends the vacancy and the chosen type, then shows the applicant stage and message (no score)", async () => {
    api.post.mockResolvedValue({
      applicationId: "a1",
      status: "shortlisted",
      message: "You are on the shortlist. HR will review your resume and documents.",
    });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("radio", { name: "Experienced" }));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(api.post).toHaveBeenCalledWith("/applicant/applications", { vacancyId: "v1", applicantType: "experienced" });
    expect(await screen.findByText("Under review")).toBeInTheDocument();
    expect(screen.getByText("You are on the shortlist. HR will review your resume and documents.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to My Profile" })).toHaveAttribute("href", "/applicant");
    expect(document.body.textContent).not.toMatch(/score|%/i);
  });

  it("shows a prescreen failure with the condition named in the message", async () => {
    api.post.mockResolvedValue({
      applicationId: "a2",
      status: "prescreen_failed",
      message: "You do not meet this job's requirements: Age must be between 18 and 35 (you are 40). You can apply to other jobs.",
      failedConditions: ["Age must be between 18 and 35 (you are 40)."],
    });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("radio", { name: "First-time job seeker" }));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Not qualified")).toBeInTheDocument();
    expect(screen.getByText(/Age must be between 18 and 35/)).toBeInTheDocument();
  });

  it("explains a refusal in a toast and closes (e.g. applications just closed)", async () => {
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "Applications for this job just closed."));
    const user = userEvent.setup();
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole("radio", { name: "Experienced" }));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Applications for this job just closed."));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
