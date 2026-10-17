// Endorsement Management (S16; FR-END-05..09, BR-17, BR-19, BR-22): the vacancy cards, the Candidates tab with the
// Create endorsement confirm (who is endorsed, who goes to standby, the API's 422 in the dialog), the Outcomes tab
// (Mark as hired / not hired with their consequences, the fill toast with the close-out counts), Training failed.
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
    awaitingConfirmation: 1,
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
  it("shows each vacancy with its to-endorse, endorsed, and hired counts", async () => {
    renderAt("/admin/endorsements");
    const card = await screen.findByRole("link", { name: "Endorsements for Cashier at Kabayan Mart" });
    expect(card).toHaveAttribute("href", `/admin/endorsements/${V}`);
    expect(within(card).getByText("To endorse").nextElementSibling).toHaveTextContent("1");
    expect(within(card).getByText("Endorsed").nextElementSibling).toHaveTextContent("3");
    expect(within(card).getByText("Hired").nextElementSibling).toHaveTextContent("1 of 2");
    expect(within(card).getByText("Endorsing")).toBeInTheDocument();
  });
});

describe("Candidates tab (FR-END-05/06)", () => {
  it("lists the confirmed applicants in ranking order with their scores and the unanswered count", async () => {
    renderAt(`/admin/endorsements/${V}`);
    expect(await screen.findByRole("heading", { name: "Cashier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Kabayan Mart · 0 of 2 slots filled")).toBeInTheDocument();
    expect(screen.getByText("2 confirmed for endorsement")).toBeInTheDocument();
    expect(screen.getByText(/^1 notified applicant still to answer\./)).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => within(r).getByText(/Ana Cruz|Ben Reyes/).textContent)).toEqual(["Ana Cruz", "Ben Reyes"]);
    expect(within(rows[0]).getByText("78.41%")).toBeInTheDocument();
  });

  it("the Create endorsement confirm names who is endorsed and who goes to standby, then posts", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ endorsementId: "e1", endorsed: ["a1", "a2"], standby: ["a3"], vacancyStatus: "endorsing" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    expect(within(dialog).getByText(/^Ana Cruz, Ben Reyes will be endorsed to Kabayan Mart\./)).toBeInTheDocument();
    expect(await within(dialog).findByText("Moved to Standby (will not go forward to the employer):")).toBeInTheDocument();
    expect(within(dialog).getByText(/Dan Uy\. They are notified and kept in the applicant pool\./)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 notified applicant has not answered yet; they stay/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsements", { vacancyId: V });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Endorsement created: 2 endorsed, 1 moved to standby."));
  });

  it("the API's 422 is shown in the confirm dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(422, "BUSINESS_RULE", "Nobody has confirmed the endorsement yet: notify passed applicants first."));
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Create endorsement" }));
    const dialog = await screen.findByRole("dialog", { name: "Create the endorsement for Cashier?" });
    await user.click(within(dialog).getByRole("button", { name: "Create endorsement" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nobody has confirmed the endorsement yet: notify passed applicants first.");
  });

  it("a filled vacancy cannot create another endorsement", async () => {
    view.vacancy.status = "filled";
    renderAt(`/admin/endorsements/${V}`);
    expect(await screen.findByRole("button", { name: "Create endorsement" })).toBeDisabled();
  });
});

describe("Outcomes tab (FR-END-07/08/09)", () => {
  beforeEach(() => {
    view.vacancy.status = "endorsing";
    view.candidates = [];
    view.endorsements = [
      {
        endorsementId: "e1",
        sentAt: "2030-10-10T06:00:00.000Z",
        items: [
          item(), // endorsed
          item({ itemId: "i2", applicationId: "a2", applicantName: "Ben Reyes", rank: 2, status: "for_hiring", clientInterviewAt: "2030-10-15T02:00:00.000Z" }),
          item({ itemId: "i3", applicationId: "a3", applicantName: "Cora Lim", rank: 3, status: "hired", outcome: "hired" }),
          item({
            itemId: "i4", applicationId: "a4", applicantName: "Dan Uy", rank: 4, status: "final_interview_scheduled",
            clientInterviewAt: "2030-10-20T01:30:00.000Z", finalInterviewDetails: "Bring two valid IDs.",
          }),
        ],
      },
    ];
  });

  it("decisions 14/15: the buttons follow the step with the client; hired only at For hiring; a packet for everyone", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [ana, ben, cora, dan] = within(batch).getAllByRole("listitem");
    const labels = (row) => within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels(ana)).toEqual([
      "Schedule Ana Cruz's final interview", "Mark Ana Cruz as not hired", "Download Ana Cruz's endorsement packet",
    ]);
    expect(labels(dan)).toEqual([
      "Dan Uy proceeds: mark as For hiring", "Dan Uy did not proceed: mark as not hired", "Change Dan Uy's final interview time",
      "Download Dan Uy's endorsement packet",
    ]);
    expect(labels(ben)).toEqual(["Mark Ben Reyes as hired", "Mark Ben Reyes as not hired", "Download Ben Reyes's endorsement packet"]);
    expect(labels(cora)).toEqual(["Mark Cora Lim's training as failed", "Download Cora Lim's endorsement packet"]);
    expect(dan).toHaveTextContent(/Final interview .+ \(Philippine time\)/);
    expect(within(dan).getByText("Instructions: Bring two valid IDs.")).toBeInTheDocument();
    expect(within(batch).getAllByText("Waiting for the client")).toHaveLength(3);
    expect(within(batch).getByRole("link", { name: "Printable page" })).toHaveAttribute("href", `/admin/endorsements/${V}/print/e1`);
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

  it("Did not proceed after the final interview opens the not-hired confirm with its own wording", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Dan Uy did not proceed: mark as not hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Dan Uy as not hired?" });
    expect(within(dialog).getByText(/^Kabayan Mart did not continue after the final interview: Dan Uy joins the applicant pool/)).toBeInTheDocument();
  });

  it("a hire that fills (from For hiring): the confirm shows the close-out counts and the toast reports the fill", async () => {
    const user = userEvent.setup();
    view.vacancy.hiredCount = 1; // slots 2: the next hire fills
    // with the client: Ben (for_hiring, being hired) and one endorsed → 1 more standby, plus the notified one
    ranking = [{ status: "endorsed" }, { status: "for_hiring" }, { status: "passed_awaiting_confirmation" }, { status: "hired" }];
    api.patch.mockResolvedValue({ itemId: "i2", status: "hired", vacancyStatus: "filled", closeOut: { notSelected: 1, standby: 2 } });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ben Reyes as hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ben Reyes as hired?" });
    expect(await within(dialog).findByText("This fills Cashier (2 of 2 hired): the vacancy closes.")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "1 applicant in the waiting pool, screening, or interview → Not selected",
      "2 applicants (passed, notified, confirmed, or endorsed and still waiting for the client) → Standby",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Mark as hired" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/endorsement-items/i2/outcome", { outcome: "hired", remarks: null });
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Marked as hired. Cashier is now filled: 1 not selected, 2 moved to standby."),
    );
  });

  it("a hire that does not fill says how many slots are filled after it", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ben Reyes as hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ben Reyes as hired?" });
    expect(within(dialog).getByText("After this, 1 of 2 slots are filled; the vacancy stays open for the others.")).toBeInTheDocument();
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

  it("Proceeds → For hiring: its confirm posts with no body and toasts", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ itemId: "i4", status: "for_hiring" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Dan Uy proceeds: mark as For hiring" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Dan Uy as For hiring?" });
    await user.click(within(dialog).getByRole("button", { name: "Mark as For hiring" }));
    expect(api.post).toHaveBeenCalledWith("/admin/endorsement-items/i4/for-hiring");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Dan Uy is For hiring."));
  });

  it("Download packet saves the PDF the API returns; an error is toasted", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["%PDF-"], { type: "application/pdf" });
    URL.createObjectURL = vi.fn(() => "blob:packet");
    URL.revokeObjectURL = vi.fn();
    api.download.mockResolvedValueOnce({ blob, filename: "Cruz_Ana_Cashier_Endorsement.pdf" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Download Ana Cruz's endorsement packet" }));
    expect(api.download).toHaveBeenCalledWith("/admin/endorsement-items/i1/packet");
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:packet");

    api.download.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "The resume file could not be added. Download it from Resume Screening."));
    await user.click(screen.getByRole("button", { name: "Download Ana Cruz's endorsement packet" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("The resume file could not be added. Download it from Resume Screening."));
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
      [{ status: "failed" }, "error", "Marked Ana Cruz as not hired. The rematch did not run. Use Run rematch again."],
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

  it("S17: a not-hired item shows its latest rematch offer (job, company, status)", async () => {
    view.endorsements[0].items[0] = item({
      status: "not_hired", outcome: "not_hired", rematchStatus: "pending", rematchJobTitle: "Store Crew", rematchCompanyName: "ClayGo",
    });
    view.endorsements[0].items[1] = item({
      itemId: "i2", applicationId: "a2", applicantName: "Ben Reyes", rank: 2, status: "not_hired", outcome: "not_hired",
      rematchStatus: "expired", rematchJobTitle: "Utility Crew", rematchCompanyName: "ClayGo",
    });
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [ana, ben] = within(batch).getAllByRole("listitem");
    expect(within(ana).getByText("Rematch:").parentElement).toHaveTextContent("Rematch:Store Crew at ClayGoWaiting for the applicant");
    // a pending offer: no decision or rematch button for Ana, only her packet (the row ends with the rematch line + packet)
    expect(ana).toHaveTextContent(/^#1 Ana Cruz.*Rematch:Store Crew at ClayGoWaiting for the applicantDownload packet$/);
    expect(within(ana).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Download Ana Cruz's endorsement packet"]);
    expect(within(ben).getByText("Rematch:").parentElement).toHaveTextContent("Rematch:Utility Crew at ClayGoExpired (no longer available)Run rematch again");
  });

  it("S17: no offer yet → Run rematch again posts and toasts the result; a 409 is toasted as an error", async () => {
    const user = userEvent.setup();
    view.endorsements[0].items[0] = item({ status: "not_hired", outcome: "not_hired", rematchStatus: null, rematchJobTitle: null, rematchCompanyName: null });
    api.post.mockResolvedValueOnce({ status: "offered", offerId: "o2", vacancyId: "v2", jobTitle: "Store Crew", companyName: "ClayGo", matchingScore: 71.15, interviewScore: 83.33, finalScore: 77.24 });
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    const [ana] = within(batch).getAllByRole("listitem");
    expect(within(ana).getByText("Rematch:").parentElement).toHaveTextContent("Rematch:No offer yetRun rematch again");

    await user.click(within(ana).getByRole("button", { name: "Run rematch again for Ana Cruz" }));
    expect(api.post).toHaveBeenCalledWith("/admin/applications/a1/rematch");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ana Cruz: VERA offered them Store Crew at ClayGo."));

    api.post.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "This applicant already has a pending rematch offer."));
    await user.click(within(ana).getByRole("button", { name: "Run rematch again for Ana Cruz" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("This applicant already has a pending rematch offer."));
  });

  it("Training failed: its own confirm with the consequence, then posts", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ applicationId: "a3", status: "training_failed" });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Cora Lim's training as failed" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Cora Lim's training as failed?" });
    expect(
      within(dialog).getByText(
        "Cora Lim's placement ends: they join the applicant pool and can no longer apply to Kabayan Mart's jobs; they can apply to other jobs. The vacancy stays filled.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark training failed" }));
    expect(api.post).toHaveBeenCalledWith("/admin/applications/a3/training-failed");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked Cora Lim's training as failed."));
  });
});
