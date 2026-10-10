// Applicant job offer after a client rejection (S17, PRD BR-23): the status panel opens the pop-up by itself; job title,
// location, employment type, and the deadline in Philippine time only (the whole pop-up text is pinned, so no company
// and no score can slip in); accept; decline with its own neutral confirm; a 409 is shown in the pop-up; after
// "Not now" the Job offer row opens it again.
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
const { StatusPanel } = await import("@/features/applications/StatusPanel");

const notHired = {
  applicationId: "a1",
  vacancyId: "v1",
  jobTitle: "Cashier",
  applicantType: "experienced",
  status: "not_hired",
  appliedAt: "2030-10-01T00:30:00.000Z",
  statusChangedAt: "2030-10-10T06:00:00.000Z",
  actionDueAt: null,
  nextDueAt: null,
};
// Answer by Oct 13, 2030, 2:00 PM in Manila.
const offer = {
  offerId: "o1",
  jobTitle: "Store Crew",
  deploymentLocation: "Bocaue, Bulacan",
  employmentType: "Full-time",
  dueAt: "2030-10-13T06:00:00.000Z",
  offeredAt: "2030-10-10T06:00:00.000Z",
};
const DESCRIPTION =
  "The agency found another job that fits your profile: Store Crew. Do you want the agency to endorse you for it? The employer makes the final hiring decision.";

let offers;

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
  offers = [offer];
  api.get.mockImplementation(async (path) => {
    if (path === "/applicant/applications") return [notHired];
    if (path === "/applicant/offers") return offers;
    throw new Error(`unexpected ${path}`);
  });
});

describe("job offer pop-up (S17)", () => {
  it("opens by itself with the job title, location, type, and Philippine-time deadline only", async () => {
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Another job for you" });
    expect(within(dialog).getByText(DESCRIPTION)).toBeInTheDocument();
    expect(within(dialog).getByText("Job").closest("dl")).toHaveTextContent(
      "JobStore CrewLocationBocaue, BulacanEmployment typeFull-timePlease answer byOct 13, 2030, 2:00 PM (Philippine time)",
      { normalizeWhitespace: false },
    );
    // the whole pop-up text, pinned: title, description, the four facts, and the buttons
    expect(dialog.textContent).toBe(
      `Another job for you${DESCRIPTION}JobStore CrewLocationBocaue, BulacanEmployment typeFull-timePlease answer byOct 13, 2030, 2:00 PM (Philippine time)Not nowDeclineAccept job offerClose`,
    );
    expect(api.get).toHaveBeenCalledWith("/applicant/offers");
  });

  it("Accept job offer posts the answer and thanks the applicant", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ offerId: "o1", status: "accepted", applicationId: "a2", applicationStatus: "for_endorsement" });
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Another job for you" });
    await user.click(within(dialog).getByRole("button", { name: "Accept job offer" }));
    expect(api.post).toHaveBeenCalledWith("/applicant/offers/o1/accept");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thank you. The agency will endorse you for Store Crew."));
  });

  it("Decline asks once more with the neutral outcome, then posts the decline", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ offerId: "o1", status: "declined" });
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Another job for you" });
    await user.click(within(dialog).getByRole("button", { name: "Decline" }));

    const confirm = await screen.findByRole("dialog", { name: "Decline the job offer for Store Crew?" });
    expect(
      within(confirm).getByText(
        "The agency will not endorse you for this job. This does not count against you: you stay in our applicant pool and can apply to other jobs.",
      ),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(0); // nothing sent before the second confirmation
    await user.click(within(confirm).getByRole("button", { name: "Decline job offer" }));
    expect(api.post).toHaveBeenCalledWith("/applicant/offers/o1/decline");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Job offer declined. You can apply to other jobs."));
  });

  it("a 409 (the job is no longer available) is shown in the pop-up", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "This job is no longer available. You can apply to other jobs."));
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Another job for you" });
    await user.click(within(dialog).getByRole("button", { name: "Accept job offer" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This job is no longer available. You can apply to other jobs.");
    expect(toast.success).toHaveBeenCalledTimes(0);
  });

  it("'Not now' closes the pop-up; the Job offer row opens it again", async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await screen.findByRole("dialog", { name: "Another job for you" });
    await user.click(within(dialog).getByRole("button", { name: "Not now" }));
    const row = within(await screen.findByRole("list", { name: "Job offers" })).getByRole("listitem");
    expect(row).toHaveTextContent("Job offer: Store CrewAnswer by Oct 13, 2030, 2:00 PM (Philippine time)View job offer");
    await user.click(within(row).getByRole("button", { name: "View job offer" }));
    expect(await screen.findByRole("dialog", { name: "Another job for you" })).toBeInTheDocument();
  });

  it("no pending offer: the panel shows the applications and no Job offers list", async () => {
    offers = [];
    renderPanel();
    expect(await screen.findByText("Cashier")).toBeInTheDocument();
    // the panel is found and goes straight from its heading to the Cashier application (no offer row in between)
    const panel = screen.getByRole("region", { name: "My applications" });
    expect(panel).toHaveTextContent(/^My applicationsCashierExperienced · Applied Oct 1, 2030, 8:30 AM/);
    expect(within(panel).queryAllByRole("list", { name: "Job offers" })).toEqual([]);
    expect(screen.queryAllByRole("dialog")).toEqual([]);
  });
});
