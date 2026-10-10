// Applicant endorsement confirmation (S15; FR-END-04, BR-15): the status panel shows the deadline and opens the pop-up by
// itself; job title and Philippine time only (never the company or a score); confirm; decline with its own confirm
// stating the neutral outcome; a 409 is shown.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { StatusPanel } = await import("./StatusPanel");

// Answer by Oct 13, 2030, 2:00 PM in Manila.
const awaiting = {
  applicationId: "a1",
  vacancyId: "v1",
  jobTitle: "Cashier",
  applicantType: "experienced",
  status: "passed_awaiting_confirmation",
  appliedAt: "2030-10-01T00:30:00.000Z",
  statusChangedAt: "2030-10-10T06:00:00.000Z",
  actionDueAt: "2030-10-13T06:00:00.000Z",
  nextDueAt: "2030-10-13T06:00:00.000Z",
};

let rows;

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StatusPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = [awaiting];
  api.get.mockImplementation(async (path) => {
    if (path === "/applicant/applications") return rows;
    throw new Error(`unexpected ${path}`);
  });
});

describe("endorsement confirmation", () => {
  it("the status panel shows the stage, the next action with the deadline, and opens the pop-up by itself", async () => {
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your endorsement" });
    expect(screen.getByText("Passed — confirm endorsement")).toBeInTheDocument();
    expect(screen.getByText(/^Confirm or decline — due Oct 13, 2030, 2:00 PM \(Philippine time\)$/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "You passed the agency assessment for Cashier. Do you want the agency to endorse you to the employer? The employer makes the final hiring decision.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Oct 13, 2030, 2:00 PM (Philippine time)")).toBeInTheDocument();
    // job title and deadline only: the dialog text names no company and no score
    expect(dialog).toHaveTextContent(/^[^%]*$/);
    expect(dialog.textContent).toMatch(/^(?!.*(Kabayan|ClayGo|company|score)).*$/is);
  });

  it("Confirm endorsement posts the answer and thanks the applicant", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ applicationId: "a1", status: "for_endorsement" });
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your endorsement" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm endorsement" }));
    expect(api.post).toHaveBeenCalledWith("/applicant/applications/a1/endorsement/confirm");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thank you. The agency will endorse you to the employer."));
  });

  it("Decline asks once more, states the neutral outcome, then posts the decline", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ applicationId: "a1", status: "archived" });
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your endorsement" });
    await user.click(within(dialog).getByRole("button", { name: "Decline" }));

    const confirm = await screen.findByRole("dialog", { name: "Decline the endorsement for Cashier?" });
    expect(
      within(confirm).getByText(
        "Your application for Cashier will be closed and you will not be endorsed to the employer. This does not count against you: you can apply to other jobs right away.",
      ),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(0); // nothing sent before the second confirmation
    await user.click(within(confirm).getByRole("button", { name: "Decline endorsement" }));
    expect(api.post).toHaveBeenCalledWith("/applicant/applications/a1/endorsement/decline");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Endorsement declined. You can apply to other jobs."));
  });

  it("'Not now' closes the pop-up; the row's Answer button opens it again", async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your endorsement" });
    await user.click(within(dialog).getByRole("button", { name: "Not now" }));
    await user.click(await screen.findByRole("button", { name: "Answer for Cashier" }));
    expect(await screen.findByRole("dialog", { name: "Confirm your endorsement" })).toBeInTheDocument();
  });

  it("a 409 (the vacancy closed out meanwhile) is shown in the pop-up", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "This endorsement is no longer waiting for your answer. Refresh the page."));
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your endorsement" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm endorsement" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This endorsement is no longer waiting for your answer. Refresh the page.");
    expect(toast.success).toHaveBeenCalledTimes(0);
  });
});
