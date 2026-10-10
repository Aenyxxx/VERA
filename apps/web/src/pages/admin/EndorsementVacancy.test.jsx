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
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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
          item(),
          item({ itemId: "i2", applicationId: "a2", applicantName: "Ben Reyes", rank: 2 }),
          item({ itemId: "i3", applicationId: "a3", applicantName: "Cora Lim", rank: 3, status: "hired", outcome: "hired" }),
        ],
      },
    ];
  });

  it("shows each endorsed applicant with the decision buttons, hired ones with Training failed, and the printable page link", async () => {
    renderAt(`/admin/endorsements/${V}`);
    const batch = await screen.findByRole("region", { name: /^Endorsement sent / });
    expect(within(batch).getByRole("button", { name: "Mark Ana Cruz as hired" })).toBeInTheDocument();
    expect(within(batch).getByRole("button", { name: "Mark Ana Cruz as not hired" })).toBeInTheDocument();
    expect(within(batch).getByRole("button", { name: "Mark Cora Lim's training as failed" })).toBeInTheDocument();
    expect(within(batch).getAllByText("Waiting for the client")).toHaveLength(2);
    expect(within(batch).getByRole("link", { name: "Printable page" })).toHaveAttribute("href", `/admin/endorsements/${V}/print/e1`);
  });

  it("not hired: the confirm states the pool and the company block, and sends the date and remarks", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ itemId: "i1", status: "not_hired", vacancyStatus: "endorsing", closeOut: null });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as not hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as not hired?" });
    expect(
      within(dialog).getByText(
        "Kabayan Mart did not hire Ana Cruz. They join the applicant pool and can no longer apply to Kabayan Mart's jobs; they can apply to other jobs.",
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Date"), "2030-10-12");
    await user.type(within(dialog).getByLabelText("Time"), "10:00");
    await user.type(within(dialog).getByLabelText("Remarks (HR only, optional)"), "Chose another candidate");
    await user.click(within(dialog).getByRole("button", { name: "Mark as not hired" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/endorsement-items/i1/outcome", {
      outcome: "not_hired",
      clientInterviewAt: "2030-10-12T10:00:00+08:00",
      remarks: "Chose another candidate",
    });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Marked Ana Cruz as not hired."));
  });

  it("a hire that fills: the confirm shows the close-out counts and the toast reports the fill", async () => {
    const user = userEvent.setup();
    view.vacancy.hiredCount = 1; // slots 2: the next hire fills
    ranking = [{ status: "endorsed" }, { status: "endorsed" }, { status: "passed_awaiting_confirmation" }, { status: "hired" }];
    api.patch.mockResolvedValue({ itemId: "i1", status: "hired", vacancyStatus: "filled", closeOut: { notSelected: 1, standby: 2 } });
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as hired?" });
    expect(await within(dialog).findByText("This fills Cashier (2 of 2 hired): the vacancy closes.")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    // waiting pool w1 → not selected; notified + the OTHER endorsed applicant → standby (the one being hired excluded)
    expect(items).toEqual([
      "1 applicant in the waiting pool, screening, or interview → Not selected",
      "2 applicants (passed, notified, confirmed, or endorsed and still waiting for the client) → Standby",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Mark as hired" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/endorsement-items/i1/outcome", { outcome: "hired", clientInterviewAt: null, remarks: null });
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

  it("only one of date and time → a readable error, nothing sent", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/endorsements/${V}`);
    await user.click(await screen.findByRole("button", { name: "Mark Ana Cruz as not hired" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark Ana Cruz as not hired?" });
    await user.type(within(dialog).getByLabelText("Date"), "2030-10-12");
    await user.click(within(dialog).getByRole("button", { name: "Mark as not hired" }));
    expect(within(dialog).getByText("Enter both the date and the time, or leave both empty.")).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledTimes(0);
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
