// Applicant dashboard "Upcoming interviews" card (S13; FR-INT-02, APP_FLOW §3.3; decision 37: notify only). The agency
// interview is set when HR schedules it: no confirmation pop-up or button, the meeting link shows at once. The client's
// final interview is listed too. Job title only (never the company); Philippine time; loading/empty/error states.
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
const { toast } = await import("sonner");
const { InterviewCard } = await import("./InterviewCard");

// Oct 12, 2030, 10:00 AM in Manila: set at once (decision 37).
const set = {
  kind: "agency",
  interviewId: "i1",
  applicationId: "a1",
  jobTitle: "Store Crew",
  status: "confirmed",
  scheduledAt: "2030-10-12T02:00:00.000Z",
  durationMinutes: 30,
  interviewerName: "Maria Santos",
  meetingLink: "https://meet.google.com/aaa-bbbb-ccc",
  requestsLeft: 2,
};
// Oct 20, 2030, 2:00 PM in Manila
const final = {
  kind: "final",
  applicationId: "a9",
  jobTitle: "Cashier",
  scheduledAt: "2030-10-20T06:00:00.000Z",
  details: "Bring a valid ID. Ask for the store manager.",
};

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
  mine = [set];
  api.get.mockImplementation(async (path) => {
    if (path === "/applicant/interviews") return mine;
    throw new Error(`unexpected ${path}`);
  });
});

describe("decision 37: notify only", () => {
  it("a scheduled interview shows its meeting link at once: no pop-up, no Confirm attendance, no confirm-by line", async () => {
    renderCard();
    const link = await screen.findByRole("link", { name: "Join the online interview" });
    expect(link).toHaveAttribute("href", "https://meet.google.com/aaa-bbbb-ccc");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Scheduled")).toBeInTheDocument(); // interview status label for confirmed (= set)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Upcoming interviews" }).textContent).not.toMatch(/confirm/i);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("card states", () => {
  it("shows the job title, time range in Philippine time, online, and interviewer — never a company", async () => {
    renderCard();
    const card = await screen.findByRole("region", { name: "Upcoming interviews" });
    await within(card).findByText("Store Crew");
    expect(within(card).getByText("OCT")).toBeInTheDocument();
    expect(within(card).getByText("12")).toBeInTheDocument();
    expect(within(card).getByText("10:00 AM – 10:30 AM (Philippine time)")).toBeInTheDocument();
    expect(within(card).getByText("Online interview")).toBeInTheDocument();
    expect(within(card).getByText("Interviewer: Maria Santos")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/company|kabayan|claygo|score/i);
  });

  it("decision 37: the client's final interview is listed with its date, time and details, never the company", async () => {
    mine = [set, final];
    renderCard();
    const card = await screen.findByRole("region", { name: "Upcoming interviews" });
    const item = (await within(card).findByText("Cashier")).closest("li");
    expect(within(item).getByText("Final interview")).toBeInTheDocument();
    expect(within(item).getByText("OCT")).toBeInTheDocument();
    expect(within(item).getByText("20")).toBeInTheDocument();
    expect(within(item).getByText("Oct 20, 2030, 2:00 PM (Philippine time)")).toBeInTheDocument();
    expect(within(item).getByText("Final interview with the employer")).toBeInTheDocument();
    expect(within(item).getByText("Bring a valid ID. Ask for the store manager.")).toBeInTheDocument();
    expect(within(item).queryByRole("button")).not.toBeInTheDocument(); // HR reschedules it; no request
    expect(within(item).queryByRole("link")).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/kabayan|claygo|score/i);
  });

  it("only a final interview: listed, and the note says to contact the agency (no request offer)", async () => {
    mine = [final];
    renderCard();
    expect(await screen.findByText("Final interview")).toBeInTheDocument();
    expect(screen.getByText("Please be on time. Can't attend? Please contact Confiable Manpower.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request/ })).not.toBeInTheDocument();
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
    expect(await screen.findByText("Your interviews could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

// Phase 4 (decision 20; TC-45) and decision 37: Request reschedule with a reason (max 2), only before the interview time.
describe("reschedule request", () => {
  it("with requests left: the card's Request reschedule opens the dialog, which posts the reason", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ interviewId: "i1", status: "reschedule_requested", requestsLeft: 1 });
    renderCard();
    expect(await screen.findByRole("link", { name: /Join the online interview/ })).toBeInTheDocument();
    expect(screen.getByText(/Request a new time before the interview \(up to 2 requests\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request reschedule" }));

    const dialog = await screen.findByRole("dialog", { name: "Request a new interview time" });
    expect(
      within(dialog).getByText(
        "Your interview for Store Crew is on Oct 12, 2030, 10:00 AM (Philippine time). You can request 2 more reschedules. The agency sets the new time.",
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Why can't you attend?"), "ok");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await within(dialog).findByText("Tell the agency why (at least 5 characters).")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Why can't you attend?"));
    await user.type(within(dialog).getByLabelText("Why can't you attend?"), "Medical check-up that morning");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    await vi.waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/applicant/interviews/i1/reschedule-request", { reason: "Medical check-up that morning" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Reschedule request sent. The agency will set a new time or keep this one.");
  });

  it("1 left: the dialog says 1 more", async () => {
    const user = userEvent.setup();
    mine = [{ ...set, requestsLeft: 1 }];
    renderCard();
    await user.click(await screen.findByRole("button", { name: "Request reschedule" }));
    expect(await screen.findByText(/You can request 1 more reschedule\./)).toBeInTheDocument();
  });

  it("decision 37: once the interview time has passed, Request reschedule disappears (the link stays)", async () => {
    mine = [{ ...set, scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }];
    renderCard();
    expect(await screen.findByRole("link", { name: "Join the online interview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request reschedule" })).not.toBeInTheDocument();
  });

  it("no requests left: no button", async () => {
    mine = [{ ...set, requestsLeft: 0 }];
    renderCard();
    expect(await screen.findByRole("link", { name: "Join the online interview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request (reschedule|a new time)/ })).not.toBeInTheDocument();
  });

  it("waiting for the agency: the card says so, with no request button or link, and no pop-up", async () => {
    mine = [{ ...set, status: "reschedule_requested", meetingLink: null, requestsLeft: 1 }];
    renderCard();
    expect(await screen.findByText("Reschedule requested. The agency will set a new time or keep this one.")).toBeInTheDocument();
    expect(screen.getByText("Reschedule requested", { selector: "span, div" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm attendance|Request reschedule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
