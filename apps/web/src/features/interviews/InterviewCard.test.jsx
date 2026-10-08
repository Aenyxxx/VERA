// Applicant dashboard interview card + confirmation pop-up (S13; FR-INT-02, APP_FLOW §3.3): opens by itself while
// an interview awaits confirmation; job title only (never the company); meeting link only after confirming;
// Philippine time; neutral wording; loading/empty/error states.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { InterviewCard } = await import("./InterviewCard");

// Oct 12, 2030, 10:00 AM in Manila; confirm by Oct 11, 2030, 10:00 AM.
const pending = {
  interviewId: "i1",
  applicationId: "a1",
  jobTitle: "Store Crew",
  status: "pending_confirmation",
  scheduledAt: "2030-10-12T02:00:00.000Z",
  durationMinutes: 30,
  confirmDueAt: "2030-10-11T02:00:00.000Z",
  confirmedAt: null,
  interviewerName: "Maria Santos",
  meetingLink: null,
};
const confirmed = { ...pending, status: "confirmed", confirmedAt: "2030-10-10T02:00:00.000Z", meetingLink: "https://meet.google.com/aaa-bbbb-ccc" };

let mine;

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InterviewCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mine = [pending];
  api.get.mockImplementation(async (path) => {
    if (path === "/applicant/interviews") return mine;
    throw new Error(`unexpected ${path}`);
  });
});

describe("confirmation pop-up", () => {
  it("opens by itself for an interview awaiting confirmation, with Philippine times and no link or company", async () => {
    renderCard();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your interview" });
    expect(within(dialog).getByText("The agency scheduled an online interview for your application for Store Crew.")).toBeInTheDocument();
    expect(within(dialog).getByText("Oct 12, 2030, 10:00 AM (Philippine time)")).toBeInTheDocument();
    expect(within(dialog).getByText("10:00 AM – 10:30 AM · 30 minutes")).toBeInTheDocument();
    expect(within(dialog).getByText("Oct 11, 2030, 10:00 AM (Philippine time)")).toBeInTheDocument(); // confirm by
    expect(within(dialog).getByText("Online (the link is shown after you confirm)")).toBeInTheDocument();
    expect(within(dialog).getByText("Can't attend at this time? Please contact Confiable Manpower.")).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/https?:|meet\.google|company|kabayan|claygo|score|congratulations|!/i);
    expect(within(dialog).queryByRole("button", { name: /reschedule/i })).not.toBeInTheDocument(); // deferred
  });

  it("Confirm attendance posts, closes, and the card then shows the meeting link", async () => {
    const user = userEvent.setup();
    api.post.mockImplementation(async () => {
      mine = [confirmed];
      return { interviewId: "i1", status: "confirmed", applicationStatus: "interview_confirmed" };
    });
    renderCard();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your interview" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm attendance" }));
    expect(api.post).toHaveBeenCalledWith("/applicant/interviews/i1/confirm");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const link = await screen.findByRole("link", { name: "Join the online interview" });
    expect(link).toHaveAttribute("href", "https://meet.google.com/aaa-bbbb-ccc");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Scheduled")).toBeInTheDocument(); // interview status label for confirmed
  });

  it("an API error (e.g. 409 time passed) stays in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "The interview time has passed. Please contact Confiable Manpower."));
    renderCard();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your interview" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm attendance" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The interview time has passed. Please contact Confiable Manpower.");
  });

  it("Cancel hides the pop-up; the card keeps Confirm attendance, which reopens it", async () => {
    const user = userEvent.setup();
    renderCard();
    const dialog = await screen.findByRole("dialog", { name: "Confirm your interview" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const card = screen.getByRole("region", { name: "Upcoming interview" });
    expect(within(card).getByText(/^Please confirm by Oct 11, 2030, 10:00 AM \(Philippine time\)\./)).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Join the online interview" })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Confirm attendance" }));
    expect(await screen.findByRole("dialog", { name: "Confirm your interview" })).toBeInTheDocument();
  });

  it("does not open for an interview that is already confirmed", async () => {
    mine = [confirmed];
    renderCard();
    expect(await screen.findByRole("link", { name: "Join the online interview" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("card states", () => {
  it("shows the job title, time range in Philippine time, online, and interviewer — never a company", async () => {
    mine = [confirmed];
    renderCard();
    const card = await screen.findByRole("region", { name: "Upcoming interview" });
    await within(card).findByText("Store Crew");
    expect(within(card).getByText("OCT")).toBeInTheDocument();
    expect(within(card).getByText("12")).toBeInTheDocument();
    expect(within(card).getByText("10:00 AM – 10:30 AM (Philippine time)")).toBeInTheDocument();
    expect(within(card).getByText("Online interview")).toBeInTheDocument();
    expect(within(card).getByText("Interviewer: Maria Santos")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/company|kabayan|claygo|score/i);
  });

  it("empty: no interview scheduled", async () => {
    mine = [];
    renderCard();
    expect(await screen.findByText("No interview scheduled. When the agency schedules one, it appears here.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("error: message and retry", async () => {
    api.get.mockRejectedValue(new ApiError(0, "NETWORK", "Can't reach VERA right now."));
    renderCard();
    expect(await screen.findByText("Your interview could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
