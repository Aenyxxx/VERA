// Interviews Assessment (S13; APP_FLOW §4.3): combined list, vacancy filter, Edit time (+08:00), Mark no-show
// (enabled only when the API allows it; consequence stated; a racing 409 shown), loading/empty/error states.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useMe", () => ({ useMe: () => ({ data: { userId: "hr1", role: "hr" }, isLoading: false }) }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Interviews } = await import("./Interviews");

const HOUR = 60 * 60 * 1000;
const at = (hours) => new Date(Date.now() + hours * HOUR).toISOString();

const row = (overrides) => ({
  interviewId: "i1",
  applicationId: "a1",
  status: "pending_confirmation",
  attemptNumber: 1,
  scheduledAt: at(48),
  durationMinutes: 30,
  meetingLink: "https://meet.google.com/aaa-bbbb-ccc",
  confirmDueAt: at(24),
  confirmedAt: null,
  interviewerId: "hr1",
  interviewerName: "Maria Santos",
  applicationStatus: "interview_scheduled",
  applicantType: "experienced",
  applicantName: "Ana Cruz",
  matchingScore: 79.31,
  vacancyId: "v1",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  ...overrides,
});

let rows;

function renderPage(path = "/admin/interviews") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: "/admin/interviews", element: <Interviews /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const rowOf = async (name) => (await screen.findByRole("link", { name })).closest("tr");

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    row(), // awaiting confirmation, deadline ahead → no-show disabled
    row({
      interviewId: "i2",
      applicationId: "a2",
      status: "confirmed",
      applicationStatus: "interview_confirmed",
      scheduledAt: at(-1),
      confirmDueAt: at(-30),
      applicantName: "Ben Reyes",
      applicantType: "first_time",
      matchingScore: 70,
    }), // confirmed, interview time passed → no-show enabled
    row({
      interviewId: "i3",
      applicationId: "a3",
      confirmDueAt: at(-2),
      scheduledAt: at(5),
      applicantName: "Cora Lim",
      vacancyId: "v2",
      jobTitle: "Store Crew",
      companyName: "ClayGo",
      matchingScore: 80,
    }), // unconfirmed, deadline passed → no-show enabled
  ];
  api.get.mockImplementation(async (path) => {
    if (path === "/admin/interviews") return rows;
    if (path === "/admin/interviewers") return [{ userId: "hr1", fullName: "Maria Santos", role: "hr" }];
    throw new Error(`unexpected ${path}`);
  });
});

describe("Interviews Assessment list", () => {
  it("shows both groups together with company, group, matching score, status, Philippine time, and the link", async () => {
    renderPage();
    const ana = await rowOf("Ana Cruz");
    expect(api.get).toHaveBeenCalledWith("/admin/interviews");
    expect(within(ana).getByText("Experienced")).toBeInTheDocument();
    expect(within(ana).getByText("Kabayan Mart")).toBeInTheDocument();
    expect(within(ana).getByText("79.31%", { exact: false })).toBeInTheDocument();
    expect(within(ana).getByText("Awaiting confirmation")).toBeInTheDocument();
    expect(within(ana).getByText(/^Confirm by /)).toBeInTheDocument();
    expect(within(ana).getByRole("link", { name: "Meeting link" })).toHaveAttribute("href", "https://meet.google.com/aaa-bbbb-ccc");
    expect(within(ana).getByRole("link", { name: "Ana Cruz" })).toHaveAttribute("href", "/admin/screening/v1/a1");

    const ben = await rowOf("Ben Reyes");
    expect(within(ben).getByText("First-time")).toBeInTheDocument();
    expect(within(ben).getByText("Scheduled")).toBeInTheDocument(); // confirmed
    expect(screen.getByRole("columnheader", { name: /Interview \(Philippine time\)/ })).toBeInTheDocument();
  });

  it("filters by vacancy (options come from the list) and keeps the choice in the URL", async () => {
    const user = userEvent.setup();
    const router = renderPage();
    await rowOf("Ana Cruz");
    const filter = screen.getByLabelText("Vacancy");
    expect(within(filter).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All vacancies",
      "Cashier · Kabayan Mart",
      "Store Crew · ClayGo",
    ]);
    await user.selectOptions(filter, "v2");
    expect(router.state.location.search).toBe("?vacancy=v2");
    expect(screen.getByRole("link", { name: "Cora Lim" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ana Cruz" })).not.toBeInTheDocument();
  });

  it("empty state points to Resume Screening", async () => {
    rows = [];
    renderPage();
    expect(await screen.findByText("No interviews scheduled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Resume Screening" })).toBeInTheDocument();
  });

  it("error state offers a retry", async () => {
    api.get.mockRejectedValue(new ApiError(0, "NETWORK", "Can't reach VERA right now."));
    renderPage();
    expect(await screen.findByText("This list could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Mark no-show (FR-INT-05 simplified)", () => {
  it("is enabled only when the API would allow it, with the reason shown otherwise", async () => {
    renderPage();
    const ana = await rowOf("Ana Cruz");
    expect(within(ana).getByRole("button", { name: "Mark Ana Cruz as no-show" })).toBeDisabled();
    expect(within(ana).getByText("Available after the confirmation deadline")).toBeInTheDocument();
    const ben = await rowOf("Ben Reyes");
    expect(within(ben).getByRole("button", { name: "Mark Ben Reyes as no-show" })).toBeEnabled();
    const cora = await rowOf("Cora Lim");
    expect(within(cora).getByRole("button", { name: "Mark Cora Lim as no-show" })).toBeEnabled();
  });

  it("a confirmed interview not started yet stays disabled even after the deadline", async () => {
    rows = [row({ status: "confirmed", confirmDueAt: at(-5), scheduledAt: at(2) })];
    renderPage();
    const ana = await rowOf("Ana Cruz");
    expect(within(ana).getByRole("button", { name: "Mark Ana Cruz as no-show" })).toBeDisabled();
    expect(within(ana).getByText("Available after the interview time")).toBeInTheDocument();
  });

  it("states the consequence (closed, company blocked, slot refilled) and posts", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ interviewId: "i2", interviewStatus: "no_show", status: "dropped", promoted: ["a9"] });
    renderPage();
    const ben = await rowOf("Ben Reyes");
    await user.click(within(ben).getByRole("button", { name: "Mark Ben Reyes as no-show" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ben Reyes as no-show?" });
    expect(
      within(dialog).getByText(
        "The applicant confirmed but did not attend. Their application for Cashier is closed, they can no longer apply to Kabayan Mart's jobs, and the next applicant in line moves up automatically.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark no-show" }));
    expect(api.post).toHaveBeenCalledWith("/admin/interviews/i2/no-show");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked as no-show. 1 applicant moved up to the shortlist."));
  });

  it("unconfirmed: the consequence names the missed deadline", async () => {
    const user = userEvent.setup();
    renderPage();
    const cora = await rowOf("Cora Lim");
    await user.click(within(cora).getByRole("button", { name: "Mark Cora Lim as no-show" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Cora Lim as no-show?" });
    expect(within(dialog).getByText(/^The applicant did not confirm the interview by the deadline\. .*ClayGo's jobs/)).toBeInTheDocument();
  });

  it("a race answered with 409 shows the API message in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "This interview is no longer open. Refresh the page."));
    renderPage();
    const cora = await rowOf("Cora Lim");
    await user.click(within(cora).getByRole("button", { name: "Mark Cora Lim as no-show" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Cora Lim as no-show?" });
    await user.click(within(dialog).getByRole("button", { name: "Mark no-show" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This interview is no longer open. Refresh the page.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Edit time", () => {
  it("prefills Philippine date/time and sends PATCH with +08:00; a confirmed interview stays confirmed", async () => {
    const user = userEvent.setup();
    rows = [row({ status: "confirmed", scheduledAt: "2030-01-15T02:00:00.000Z", confirmDueAt: "2030-01-14T02:00:00.000Z" })];
    api.patch.mockResolvedValue({ interviewId: "i1", status: "confirmed" });
    renderPage();
    const ana = await rowOf("Ana Cruz");
    await user.click(within(ana).getByRole("button", { name: "Edit time for Ana Cruz" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit interview time" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2030-01-15");
    expect(within(dialog).getByLabelText("Time (Philippine time)")).toHaveValue("10:00");
    expect(within(dialog).getByLabelText("Meeting link")).toHaveValue("https://meet.google.com/aaa-bbbb-ccc");
    expect(within(dialog).getByText(/The applicant already confirmed\. The interview stays confirmed/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Time (Philippine time)"));
    await user.type(within(dialog).getByLabelText("Time (Philippine time)"), "10:01");
    await user.click(within(dialog).getByRole("button", { name: "Save new time" }));
    await vi.waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/admin/interviews/i1", {
        scheduledAt: "2030-01-15T10:01:00+08:00",
        durationMinutes: 30,
        meetingLink: "https://meet.google.com/aaa-bbbb-ccc",
        interviewerId: "hr1",
      }),
    );
  });
});
