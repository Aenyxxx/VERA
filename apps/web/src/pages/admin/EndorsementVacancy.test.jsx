// Endorsement Management (S16; FR-END-05..09, BR-17, BR-19, BR-22): the vacancy cards, the Candidates tab with the
// Create endorsement confirm (who is endorsed, who goes to standby, the API's 422 in the dialog), the Outcomes tab
// (decision 37C: the stage tracker, only the next valid buttons, Mark as deployed / not hired with their consequences,
// the fill toast with the close-out counts), Training failed at For training.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), download: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Endorsements } = await import("./Endorsements");
const { default: EndorsementVacancy } = await import("./EndorsementVacancy");

const V = "v1";
const candidate = (overrides) => ({
  applicationId: "a1", rank: 1, applicantName: "Ana Cruz", applicantType: "experienced", status: "for_endorsement",
  matchingScore: 79.31, interviewScore: 77.5, finalScore: 78.41, ...overrides,
});
const item = (overrides) => ({
  itemId: "i1", applicationId: "a1", applicantName: "Ana Cruz", applicantType: "experienced", status: "endorsed", rank: 1,
  finalScore: 78.41, outcome: "pending", clientInterviewAt: null, outcomeRemarks: null, outcomeRecordedAt: null, ...overrides,
});

let view;
let ranking;

// Decision 32: the batch's final interview as the dialog posts it (Philippine time).
const SCHEDULE = { finalInterviewAt: "2030-10-16T09:30:00+08:00", finalInterviewDetails: "Bring two valid IDs." };
async function fillFinalInterview(dialog) {
  const user = userEvent.setup();
  await user.type(within(dialog).getByLabelText("Date"), "2030-10-16");
  await user.type(within(dialog).getByLabelText("Time"), "09:30");
  await user.type(within(dialog).getByLabelText("Location and details"), "Bring two valid IDs.");
}

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/endorsements", element: <Endorsements /> },
      { path: "/admin/endorsements/:vacancyId", element: <EndorsementVacancy /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  view = {
    vacancy: { vacancyId: V, jobTitle: "Cashier", companyName: "Kabayan Mart", status: "closed", slotsNeeded: 2, endorsementCount: 4, hiredCount: 0, passedCount: 1 },
    candidates: [candidate(), candidate({ applicationId: "a2", rank: 2, applicantName: "Ben Reyes", finalScore: 76 })],
    endorsements: [],
  };
  ranking = [{ applicationId: "a3", applicantName: "Dan Uy", status: "passed" }, { applicationId: "a1", applicantName: "Ana Cruz", status: "for_endorsement" }];
  api.get.mockImplementation(async (path) => {
    if (path === "/admin/endorsements") {
      return [{ vacancyId: V, jobTitle: "Cashier", companyName: "Kabayan Mart", status: "endorsing", slotsNeeded: 2, endorsementCount: 4, forEndorsement: 1, endorsed: 3, hired: 1 }];
    }
    if (path === `/admin/endorsements/${V}`) return view;
    if (path === `/admin/vacancies/${V}/ranking`) return { vacancy: {}, ranking };
    if (path === `/admin/screening/${V}`) return { groups: { experienced: { shortlisted: [], waitingPool: [{ applicationId: "w1" }] }, first_time: { shortlisted: [], waitingPool: [] } } };
    if (path === `/admin/interviews?vacancyId=${V}`) return [];
    throw new Error(`unexpected ${path}`);
  });
});

describe("Endorsement Management list", () => {
  it("shows each vacancy with its to-endorse, endorsed, and deployed counts", async () => {
    renderAt("/admin/endorsements");
    const card = await screen.findByRole("link", { name: "Endorsements for Cashier at Kabayan Mart" });
    expect(card).toHaveAttribute("href", `/admin/endorsements/${V}`);
    expect(within(card).getByText("To endorse").nextElementSibling).toHaveTextContent("1");
    expect(within(card).getByText("Endorsed").nextElementSibling).toHaveTextContent("3");
    expect(within(card).getByText("Deployed").nextElementSibling).toHaveTextContent("1 of 2"); // decision 37C: hired = Deployed
    expect(within(card).queryByText("Hired")).not.toBeInTheDocument();
    expect(within(card).getByText("Endorsing")).toBeInTheDocument();
    // decision 36: the page header has no description
    const heading = screen.getByRole("heading", { name: "Endorsement Management", level: 1 });
    expect(heading.nextElementSibling).toBeNull();
    expect(screen.queryByText(/Create the endorsement from the applicants who confirmed/)).not.toBeInTheDocument();
  });
});

describe("Candidates tab (FR-END-05/06)", () => {
  it("lists the notified applicants (for endorsement) in ranking order with their scores; no unanswered count (37B)", async () => {
    renderAt(`/admin/endorsements/${V}`);
    expect(await screen.findByRole("heading", { name: "Cashier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Kabayan Mart · 0 of 2 slots filled")).toBeInTheDocument();
    const count = screen.getByText("2 for endorsement");
    expect(count.nextElementSibling).toBeNull(); // decision 37B: nobody answers, so no "still to answer" line
    expect(screen.queryByText(/still to answer|confirmed for endorsement|Ranking tab/)).not.toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => within(r).getByText(/Ana Cruz|Ben Reyes/).textContent)).toEqual(["Ana Cruz", "Ben Reyes"]);
    expect(within(rows[0]).getByText("78.41%")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Remove Ana Cruz from the endorsement" })).toBeInTheDocument();
  });

  it("decision 37B: Remove from endorsement needs a reason, states the consequence, posts, and shows a 409 in the dialog", async () => {
    const user = userEvent.setup();
    api.post
      .mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Only an applicant waiting for the endorsement can be removed. Refresh the page."))
      .mockResolvedValueOnce({ applicationId: "a2", status: "archived" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Remove Ben Reyes from the endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Ben Reyes from the endorsement?" });
    expect(
      within(dialog).getByText(
        "Ben Reyes will not be endorsed for Cashier. The application is closed (neutral: no applicant pool entry, no company block) and the place can be given to another passed applicant. The applicant is told only that the application will not go forward.",
      ),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Reason"), "no");
    await user.click(within(dialog).getByRole("button", { name: "Remove from endorsement" }));
    expect(within(dialog).getByText("Write at least 5 characters.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Reason"));
    await user.type(within(dialog).getByLabelText("Reason"), "  Accepted another job offer.  ");
    await user.click(within(dialog).getByRole("button", { name: "Remove from endorsement" }));
    expect(api.post).toHaveBeenCalledWith("/admin/applications/a2/remove-from-endorsement", { reason: "Accepted another job offer." });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only an applicant waiting for the endorsement can be removed.");
    expect(toast.success).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Remove from endorsement" }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ben Reyes was removed from the endorsement."));
  });

  it("decision 36: nobody for endorsement → the empty state is its title only", async () => {
    view.candidates = [];
    renderAt(`/admin/endorsements/${V}`);
    const count = await screen.findByText("0 for endorsement");
    expect(count.nextElementSibling).toBeNull();
    expect(screen.queryByText(/Nobody else is waiting|still to answer|Ranking tab/)).not.toBeInTheDocument();
    const empty = screen.getByText("Nobody to endorse yet");
    expect(empty.nextElementSibling).toBeNull();
    expect(screen.queryByText(/Applicants appear here after they confirm/)).not.toBeInTheDocument();
  });

  it("decision 36: the empty Outcomes tab shows its title only", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("tab", { name: "Outcomes" }));
    const empty = await screen.findByText("No endorsement yet");
    expect(empty.nextElementSibling).toBeNull();
    expect(screen.queryByText(/Create the endorsement from the Candidates tab/)).not.toBeInTheDocument();
  });

  it("the Create endorsement confirm names who is endorsed and who goes to standby, then posts", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ endorsementId: "e1", endorsed: ["a1", "a2"], standby: ["a3"], vacancyStatus: "endorsing" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    expect(
      within(dialog).getByText(
        "Ana Cruz, Ben Reyes will be endorsed to Kabayan Mart with the final interview below. After this, print the endorsement page and send it to the client.",
      ),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText("Moved to Standby (will not go forward to the employer):")).toBeInTheDocument();
    expect(within(dialog).getByText(/Dan Uy\. They are notified and kept in the applicant pool\./)).toBeInTheDocument();
    expect(within(dialog).queryByText(/not answered yet/)).not.toBeInTheDocument(); // decision 37B: nobody answers

    // decision 32: the final interview is required, then posted with the batch (nothing prefilled)
    expect(within(dialog).getByLabelText("Date")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(within(dialog).getByText("Enter the date and the time.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the final interview details.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsements", { vacancyId: V, ...SCHEDULE, acknowledgeChange: false });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Endorsement created: 2 endorsed, 1 moved to standby."));
  });

  it("decision 32: a schedule that differs from the Notify message → warning with the names, then 'Create and send time changed'", async () => {
    const user = userEvent.setup();
    api.post
      .mockRejectedValueOnce(
        new ApiError(409, "FINAL_INTERVIEW_CHANGED", "This final interview differs from what some applicants were told.", [{ applicationId: "a2" }]),
      )
      .mockResolvedValueOnce({ endorsementId: "e1", endorsed: ["a1", "a2"], standby: [], vacancyStatus: "endorsing", timeChanged: ["a2"], firstNotice: [] });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));

    const warning = await within(dialog).findByRole("alert");
    expect(warning).toHaveTextContent(/This final interview differs from what Ben Reyes was told in the Notify message\./);
    expect(warning).toHaveTextContent(/they get "Final interview time changed"/);
    expect(warning).not.toHaveClass("text-error"); // a warning, not the API's error box

    await user.click(within(dialog).getByRole("button", { name: "Create and send 'time changed'" }));
    expect(api.post).toHaveBeenLastCalledWith("/admin/endorsements", { vacancyId: V, ...SCHEDULE, acknowledgeChange: true });
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Endorsement created: 2 endorsed. 1 applicant was sent "Final interview time changed".'),
    );
  });

  it("decision 32: editing the schedule after the warning asks again (no acknowledgement carried over)", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce(
      new ApiError(409, "FINAL_INTERVIEW_CHANGED", "This final interview differs from what some applicants were told.", [{ applicationId: "a2" }]),
    );
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(await within(dialog).findByRole("button", { name: "Create and send 'time changed'" })).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Time"));
    await user.type(within(dialog).getByLabelText("Time"), "10:30");
    expect(within(dialog).queryByText(/differs from what/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(api.post).toHaveBeenLastCalledWith("/admin/endorsements", {
      vacancyId: V,
      ...SCHEDULE,
      finalInterviewAt: "2030-10-16T10:30:00+08:00",
      acknowledgeChange: false,
    });
  });

  it("the API's 422 is shown in the confirm dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(422, "BUSINESS_RULE", "Nobody has confirmed the endorsement yet: notify passed applicants first."));
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nobody has confirmed the endorsement yet: notify passed applicants first.");
  });

  it("a filled vacancy cannot create another endorsement", async () => {
    view.vacancy.status = "filled";
    renderAt(`/admin/endorsements/${V}`);
    expect(await screen.findByRole("button", { name: "Create endorsement" })).toBeDisabled();
  });
});

describe("Outcomes tab (FR-END-07/08/09; decision 37C)", () => {
  beforeEach(() => {
    view.vacancy.status = "endorsing";
    view.candidates = [];
    view.endorsements = [
      {
        endorsementId: "e1",
        sentAt: "2030-10-10T06:00:00.000Z",
        items: [
          item(), // endorsed
          item({ itemId: "i2", applicationId: "a2", applicantName: "Ben Reyes", rank: 2, status: "for_orientation", clientInterviewAt: "2030-10-15T02:00:00.000Z" }),
          item({ itemId: "i3", applicationId: "a3", applicantName: "Cora Lim", rank: 3, status: "hired", outcome: "hired" }),
          item({
            itemId: "i4", applicationId: "a4", applicantName: "Dan Uy", rank: 4, status: "final_interview_scheduled",
            clientInterviewAt: "2030-10-20T01:30:00.000Z", finalInterviewDetails: "Bring two valid IDs.",
          }),
          item({ itemId: "i5", applicationId: "a5", applicantName: "Eve Tan", rank: 5, status: "for_training" }),
          item({ itemId: "i6", applicationId: "a6", applicantName: "Fay Go", rank: 6, status: "for_requirements" }),
        ],
      },
    ];
  });

  // the applicant rows (each row also holds the stage tracker's own list)
  const rowsOf = (batch) => within(batch).getAllByRole("listitem").filter((li) => !li.closest("ol"));
  const labels = (row) => within(row).queryAllByRole("button").map((b) => b.getAttribute("aria-label"));
  const stages = (row) => {
    const tracker = within(row).getByRole("list", { name: "Client stages" });
    return within(tracker)
      .getAllByRole("listitem")
      .map((li) => `${li.textContent}${li.getAttribute("aria-current") === "step" ? " [current]" : ""}`);
  };

  it("decision 37C: only the next valid buttons per stage; Deployed only at For orientation; nothing after Deployed; no packet (decision 33)", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [ana, ben, cora, dan, eve, fay] = rowsOf(batch);
    // decision 33: the endorsement packet is on the Ranking tab, so the exact lists below have no Download button
    expect(labels(ana)).toEqual(["Schedule Ana Cruz's final interview", "Mark Ana Cruz as not hired"]);
    expect(labels(dan)).toEqual(["Change Dan Uy's final interview time", "Dan Uy: Proceed", "Mark Dan Uy as not hired"]);
    expect(labels(eve)).toEqual(["Eve Tan: Training passed", "Mark Eve Tan's training as failed", "Mark Eve Tan as not hired"]);
    expect(labels(fay)).toEqual(["Fay Go: For orientation", "Mark Fay Go as not hired"]);
    expect(labels(ben)).toEqual(["Mark Ben Reyes as deployed", "Mark Ben Reyes as not hired"]);
    expect(labels(cora)).toEqual([]);
    expect(within(batch).queryAllByRole("button", { name: /as hired$|For hiring/ })).toEqual([]);
    expect(dan).toHaveTextContent(/Final interview .+ \(Philippine time\)/);
    expect(within(dan).getByText("Instructions: Bring two valid IDs.")).toBeInTheDocument();
    expect(within(batch).getAllByText("Waiting for the client")).toHaveLength(5);
    expect(within(cora).getAllByText("Deployed").length).toBeGreaterThan(0);
    expect(within(batch).getByRole("link", { name: "Printable page" })).toHaveAttribute("href", `/admin/endorsements/${V}/print/e1`);
  });

  it("decision 37C: the stage tracker shows the fixed order with the current stage highlighted", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [ana, ben, cora, dan, eve, fay] = rowsOf(batch);
    const order = ["Final interview", "For training", "For requirements", "For orientation", "Deployed"];
    expect(stages(ana)).toEqual(order); // endorsed: no stage reached yet
    expect(stages(dan)).toEqual(["Final interview [current]", ...order.slice(1)]);
    expect(stages(eve)).toEqual(["Final interview (done)", "For training [current]", ...order.slice(2)]);
    expect(stages(fay)).toEqual(["Final interview (done)", "For training (done)", "For requirements [current]", ...order.slice(3)]);
    expect(stages(ben)).toEqual(["Final interview (done)", "For training (done)", "For requirements (done)", "For orientation [current]", "Deployed"]);
    expect(stages(cora)).toEqual(order.map((s) => `${s} (done)`));
  });

  it.each([
    ["Dan Uy: Proceed", "Move Dan Uy to For training?", "Proceed to training", "i4", "for_training", "Dan Uy is For training."],
    ["Eve Tan: Training passed", "Mark Eve Tan's training as passed?", "Training passed", "i5", "for_requirements", "Eve Tan is For requirements."],
    ["Fay Go: For orientation", "Move Fay Go to For orientation?", "Move to orientation", "i6", "for_orientation", "Fay Go is For orientation."],
  ])("decision 37C: %s → its confirm posts the next stage and toasts", async (button, title, confirm, itemId, to, done) => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ itemId, status: to });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: button }));
    const dialog = await screen.findByRole("dialog", { name: title });
    await user.click(within(dialog).getByRole("button", { name: confirm }));
    expect(api.post).toHaveBeenCalledWith(`/admin/endorsement-items/${itemId}/advance`, { to });
    expect(api.post).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith(done));
  });

  it("decision 37C: a 409 from advance (moved meanwhile) is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "BUSINESS_RULE", "This applicant is not at the step before that stage. Refresh the page."));
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Eve Tan: Training passed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Eve Tan's training as passed?" });
    await user.click(within(dialog).getByRole("button", { name: "Training passed" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This applicant is not at the step before that stage.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("decision 37C: a batch whose applicants all left (not hired / training failed) keeps its header and Printable page", async () => {
    view.endorsements = [{ endorsementId: "e9", sentAt: "2030-10-09T06:00:00.000Z", items: [] }];
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    expect(within(batch).getByText("No applicant from this endorsement is still with the client.")).toBeInTheDocument();
    expect(within(batch).getByRole("link", { name: "Printable page" })).toHaveAttribute("href", `/admin/endorsements/${V}/print/e9`);
    expect(within(batch).queryAllByRole("button")).toEqual([]);
  });

  it("not hired before the final interview: the confirm says the client declined, then sends only outcome and remarks", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ itemId: "i1", status: "not_hired", vacancyStatus: "endorsing", closeOut: null });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as not hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as not hired?" });
    expect(
      within(dialog).getByText(
        "Kabayan Mart declined before the final interview: Ana Cruz joins the applicant pool and can no longer apply to Kabayan Mart's jobs for 1 year; they can apply to other jobs, and VERA looks for another job for them.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Date")).not.toBeInTheDocument(); // the time is the final interview now
    await user.type(within(dialog).getByLabelText("Remarks (HR only, optional)"), "Chose another candidate");
    await user.click(within(dialog).getByRole("button", { name: "Mark as not hired" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/endorsement-items/i1/outcome", { outcome: "not_hired", remarks: "Chose another candidate" });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked Ana Cruz as not hired."));
  });

  it.each([
    ["Dan Uy", "did not continue after the final interview"],
    ["Eve Tan", "decided not to hire during training"],
    ["Fay Go", "decided not to hire at the requirements step"],
    ["Ben Reyes", "decided not to hire at orientation"],
  ])("Not hired for %s opens the not-hired confirm with its stage's wording", async (name, meaning) => {
    const user = userEvent.setup();
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: `Mark ${name} as not hired` }));
    const dialog = await screen.findByRole("dialog", { name: `Mark ${name} as not hired?` });
    expect(within(dialog).getByText(new RegExp(`^Kabayan Mart ${meaning}: ${name} joins the applicant pool`))).toBeInTheDocument();
  });

  it("a deployment that fills (from For orientation): the confirm shows the close-out counts and the toast reports the fill", async () => {
    const user = userEvent.setup();
    view.vacancy.hiredCount = 1; // slots 2: the next deployment fills
    // with the client: Ben (for_orientation, being deployed) and one in training → 1 more standby, plus the notified one
    ranking = [{ status: "for_training" }, { status: "for_orientation" }, { status: "for_endorsement" }, { status: "hired" }];
    api.patch.mockResolvedValue({ itemId: "i2", status: "hired", vacancyStatus: "filled", closeOut: { notSelected: 1, standby: 2 } });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ben Reyes as deployed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ben Reyes as deployed?" });
    expect(await within(dialog).findByText("This fills Cashier (2 of 2 deployed): the vacancy closes.")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "1 applicant in the waiting pool, screening, or interview → Not selected",
      "2 applicants (passed, notified, or still with the client) → Standby",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Mark as deployed" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/endorsement-items/i2/outcome", { outcome: "hired", remarks: null });
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Marked as deployed. Cashier is now filled: 1 not selected, 2 moved to standby."),
    );
  });

  it("a deployment that does not fill says how many slots are filled after it", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ itemId: "i2", status: "hired", vacancyStatus: "endorsing", closeOut: null });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ben Reyes as deployed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ben Reyes as deployed?" });
    expect(within(dialog).getByText("After this, 1 of 2 slots are filled; the vacancy stays open for the others.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark as deployed" }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked Ben Reyes as deployed."));
  });

  it("an old For hiring row can still be deployed (no stage button for it)", async () => {
    view.endorsements[0].items = [item({ itemId: "i7", applicationId: "a7", applicantName: "Gil Ong", status: "for_hiring" })];
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [gil] = rowsOf(batch);
    expect(labels(gil)).toEqual(["Mark Gil Ong as deployed", "Mark Gil Ong as not hired"]);
  });

  it("Schedule final interview: date and time required, sent in Philippine time with the details; the toast says notified", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ itemId: "i1", status: "final_interview_scheduled" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Schedule Ana Cruz's final interview" }));
    const dialog = await screen.findByRole("dialog", { name: "Schedule Ana Cruz's final interview" });
    await user.type(within(dialog).getByLabelText("Date"), "2030-10-20");
    await user.click(within(dialog).getByRole("button", { name: "Schedule and notify" }));
    expect(within(dialog).getByText("Enter the date and the time.")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(0);
    await user.type(within(dialog).getByLabelText("Time"), "09:30");
    await user.type(within(dialog).getByLabelText("Instructions for the applicant (optional, no company name)"), "Bring two valid IDs.");
    await user.click(within(dialog).getByRole("button", { name: "Schedule and notify" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsement-items/i1/final-interview", {
      scheduledAt: "2030-10-20T09:30:00+08:00",
      details: "Bring two valid IDs.",
    });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Final interview scheduled. Ana Cruz was notified."));
  });

  it("Change time is prefilled from the stored final interview (Philippine time) and the API's 422 shows in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(422, "BUSINESS_RULE", "Remove the company name: applicants never see the client company."));
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Change Dan Uy's final interview time" }));
    const dialog = await screen.findByRole("dialog", { name: "Change Dan Uy's final interview" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2030-10-20");
    expect(within(dialog).getByLabelText("Time")).toHaveValue("09:30");
    expect(within(dialog).getByLabelText("Instructions for the applicant (optional, no company name)")).toHaveValue("Bring two valid IDs.");
    await user.click(within(dialog).getByRole("button", { name: "Save and notify" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsement-items/i4/final-interview", {
      scheduledAt: "2030-10-20T09:30:00+08:00",
      details: "Bring two valid IDs.",
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Remove the company name");
  });

  it("decision 33: the Outcomes tab has no Download packet (it moved to the Ranking tab); the printable page stays", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    expect(within(batch).getAllByRole("button").length).toBeGreaterThan(0);
    expect(within(batch).getByRole("link", { name: "Printable page" })).toBeInTheDocument();
    expect(within(batch).queryAllByRole("button", { name: /endorsement packet/ })).toEqual([]);
    expect(within(batch).queryByText("Download packet")).not.toBeInTheDocument();
    expect(api.download).not.toHaveBeenCalled();
  });

  it("a 409 (decided by someone else) is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue(new ApiError(409, "CONFLICT", "The client's decision for this applicant was already recorded, or the application moved. Refresh the page."));
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as not hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as not hired?" });
    await user.click(within(dialog).getByRole("button", { name: "Mark as not hired" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already recorded");
  });

  it("S17: Mark as not hired shows the rematch result from the response (offered / no match / failed)", async () => {
    const user = userEvent.setup();
    const cases = [
      [{ status: "offered", offerId: "o1", jobTitle: "Store Crew", companyName: "ClayGo" }, "success", "Marked Ana Cruz as not hired. VERA offered them Store Crew at ClayGo."],
      [{ status: "no_match" }, "success", "Marked Ana Cruz as not hired. No matching open job right now; they stay in the applicant pool."],
      // decision 39-2: no manual rematch to point to; the applicant stays in the pool for the next published job
      [{ status: "failed" }, "error", "Marked Ana Cruz as not hired. The rematch did not run; they stay in the applicant pool and are matched when a new job is published."],
    ];
    renderAt(`/admin/endorsements/${V}`);
    for (const [rematch, kind, text] of cases) {
      api.patch.mockResolvedValueOnce({ itemId: "i1", status: "not_hired", vacancyStatus: "endorsing", closeOut: null, rematch });
      await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as not hired" }));
      const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as not hired?" });
      await user.click(within(dialog).getByRole("button", { name: "Mark as not hired" }));
      await vi.waitFor(() => expect(toast[kind]).toHaveBeenLastCalledWith(text));
    }
  });

  it("decision 39-2: no Run rematch again on the Outcomes tab (nor anywhere: the rematch is automatic only)", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    expect(within(batch).queryByText("Rematch:")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /rematch/i })).toEqual([]);
  });

  it("Training failed (only at For training): its own confirm with the consequence, then posts by item", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ itemId: "i5", applicationId: "a5", status: "training_failed" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Eve Tan's training as failed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Eve Tan's training as failed?" });
    expect(
      within(dialog).getByText(
        "Eve Tan does not continue: they join the applicant pool (Returned by Client) and can no longer apply to Kabayan Mart's jobs; they can apply to other jobs.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark training failed" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsement-items/i5/training-failed");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked Eve Tan's training as failed."));
  });
});
