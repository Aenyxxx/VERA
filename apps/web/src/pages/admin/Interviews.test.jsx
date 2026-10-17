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
  const router = createMemoryRouter(
    [
      { path: "/admin/interviews", element: <Interviews /> },
      { path: "/admin/interviews/:vacancyId", element: <Interviews /> },
      { path: "/admin/interviews/:vacancyId/:applicationId", element: <p>Evaluation page</p> },
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

  it("/admin/interviews/:vacancyId shows that vacancy's interviews with the filter preselected", async () => {
    renderPage("/admin/interviews/v2");
    expect(await screen.findByRole("link", { name: "Cora Lim" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vacancy")).toHaveValue("v2");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("link", { name: /^(Ana Cruz|Ben Reyes|Cora Lim)$/ }).map((l) => l.textContent)).toEqual(["Cora Lim"]);
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

describe("Evaluate (FR-INT-06, S14)", () => {
  it("a confirmed interview whose time has passed links to the evaluation page", async () => {
    const user = userEvent.setup();
    const router = renderPage();
    const ben = await rowOf("Ben Reyes");
    const evaluate = within(ben).getByRole("link", { name: "Evaluate Ben Reyes" });
    expect(evaluate).toHaveAttribute("href", "/admin/interviews/v1/a2");
    await user.click(evaluate);
    expect(router.state.location.pathname).toBe("/admin/interviews/v1/a2");
    expect(await screen.findByText("Evaluation page")).toBeInTheDocument();
  });

  it("awaiting confirmation: disabled with 'Evaluate after the applicant confirms'", async () => {
    renderPage();
    const ana = await rowOf("Ana Cruz");
    expect(within(ana).getByRole("button", { name: "Evaluate Ana Cruz" })).toBeDisabled();
    expect(within(ana).getByText("Evaluate after the applicant confirms")).toBeInTheDocument();
  });

  it("confirmed but not started yet: disabled until the interview time", async () => {
    rows = [row({ status: "confirmed", confirmDueAt: at(-5), scheduledAt: at(2) })];
    renderPage();
    const ana = await rowOf("Ana Cruz");
    const evaluate = within(ana).getByRole("button", { name: "Evaluate Ana Cruz" });
    expect(evaluate).toBeDisabled();
    expect(evaluate).toHaveAttribute("title", "Available after the interview time");
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

// Phase 4 (decision 20; TC-45, TC-111, TC-112): a waiting reschedule request shows its reason; HR approves with a
// new time (+08:00) or declines; edit, no-show, and evaluate wait for the answer.
describe("reschedule requests", () => {
  const requested = () =>
    row({
      status: "reschedule_requested",
      scheduledAt: "2030-01-15T02:00:00.000Z",
      confirmDueAt: "2030-01-14T02:00:00.000Z",
      rescheduleReason: "Medical check-up that morning",
      rescheduleRequests: 1,
    });

  it("shows the reason and the count; only Approve and Decline are offered", async () => {
    rows = [requested()];
    renderPage();
    const ana = await rowOf("Ana Cruz");
    expect(within(ana).getByText("Reschedule requested")).toBeInTheDocument();
    expect(within(ana).getByText("Reason: Medical check-up that morning")).toBeInTheDocument();
    expect(within(ana).getByText("Request 1 of 2")).toBeInTheDocument();
    expect(within(ana).getAllByRole("button").map((b) => b.textContent)).toEqual(["Approve", "Decline"]);
    expect(within(ana).queryByRole("button", { name: /Edit time|no-show|Evaluate/ })).not.toBeInTheDocument();
  });

  it("Approve: empty date and time, the rest prefilled, posts the new time with +08:00", async () => {
    const user = userEvent.setup();
    rows = [requested()];
    api.post.mockResolvedValue({ interviewId: "i9", attemptNumber: 2, status: "pending_confirmation", applicationStatus: "interview_scheduled" });
    renderPage();
    await user.click(within(await rowOf("Ana Cruz")).getByRole("button", { name: "Approve the reschedule for Ana Cruz" }));
    const dialog = await screen.findByRole("dialog", { name: "Set the new interview time" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("");
    expect(within(dialog).getByLabelText("Time (Philippine time)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Meeting link")).toHaveValue("https://meet.google.com/aaa-bbbb-ccc");
    expect(within(dialog).getByText(/The applicant asked to reschedule: "Medical check-up that morning"\./)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Date"), "2030-01-17");
    await user.type(within(dialog).getByLabelText("Time (Philippine time)"), "14:30");
    await user.click(within(dialog).getByRole("button", { name: "Approve with this time" }));
    await vi.waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/interviews/i1/reschedule/approve", {
        scheduledAt: "2030-01-17T14:30:00+08:00",
        durationMinutes: 30,
        meetingLink: "https://meet.google.com/aaa-bbbb-ccc",
        interviewerId: "hr1",
      }),
    );
    expect(api.patch).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("New time sent. The applicant confirms it on their dashboard.");
  });

  it("Decline: states that the time stays, then posts; a 409 stays in the dialog", async () => {
    const user = userEvent.setup();
    rows = [requested()];
    api.post.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "There is no reschedule request to answer. Refresh the page."));
    renderPage();
    await user.click(within(await rowOf("Ana Cruz")).getByRole("button", { name: "Decline the reschedule for Ana Cruz" }));
    const dialog = await screen.findByRole("dialog", { name: "Keep the current time for Ana Cruz?" });
    expect(
      within(dialog).getByText(
        "The applicant is told the interview stays on Jan 15, 2030, 10:00 AM (Philippine time). The request still counts toward their 2 requests.",
      ),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Decline request" }));
    expect(api.post).toHaveBeenCalledWith("/admin/interviews/i1/reschedule/decline");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("There is no reschedule request to answer. Refresh the page.");

    api.post.mockResolvedValueOnce({ interviewId: "i1", status: "pending_confirmation" });
    await user.click(within(dialog).getByRole("button", { name: "Decline request" }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reschedule request declined. The applicant was notified."));
  });
});
