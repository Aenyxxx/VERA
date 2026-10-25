// Vacancy list + detail: cards, publish (TC-25), reopen at cap (FR-VAC-07).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Vacancies } = await import("./Vacancies");
const { default: VacancyDetail } = await import("./VacancyDetail");

const CARD = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  status: "open",
  slotsNeeded: 2,
  remainingSlots: 1,
  counts: { total: 9, screening: 4, interview: 2, passed: 1, hired: 1 },
};
const DETAIL = {
  vacancyId: "v1",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  status: "draft",
  jobDescription: "Handles payments.",
  keyResponsibilities: "Process payments",
  requiredSkills: "Cash handling",
  experienceRequirement: null,
  minYearsExperience: 1,
  minAge: 18,
  maxAge: 35,
  genderRequirement: "any",
  minEducationLevel: "senior_high",
  minHeightCm: null,
  deploymentLocation: "Baliuag",
  employmentType: "Full-time",
  slotsNeeded: 2,
  shortlistPerGroup: 4,
  applicationCap: 16,
  applicationCount: 0,
  endorsementCount: 3,
  matchingThreshold: 40,
  passingScore: 75,
  postedAt: null,
  sectionWeights: [
    { sectionCode: "A", sectionName: "Communication and Interpersonal Skills", weight: 30, items: ["Oral Communication/Listening", "Co-Worker Relations/Teamwork", "Customer Relations"] },
    { sectionCode: "B", sectionName: "Personal Effectiveness Skills and Traits", weight: 30, items: ["Problem Solving", "Time Management"] },
    { sectionCode: "C", sectionName: "Job Specific Skills and Experience", weight: 40, items: ["Experience", "Education / Training", "Technical Skills"] },
  ],
  weightTotal: 100,
  editable: { full: true, postingText: false, capIncrease: false },
};

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/vacancies", element: <Vacancies /> },
      { path: "/admin/vacancies/:id", element: <VacancyDetail /> },
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

describe("Job Vacancies list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows cards with company, status, remaining slots, and stage counts (FR-VAC-05)", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    renderAt("/admin/vacancies");

    const card = (await screen.findByRole("heading", { name: "Cashier" })).closest("a");
    expect(screen.getByRole("heading", { name: "Job Vacancies", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Manpower requests from client companies.")).not.toBeInTheDocument(); // decision 35
    expect(card).toHaveAttribute("href", "/admin/vacancies/v1");
    expect(within(card).getByText("Kabayan Mart")).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
    expect(card).toHaveTextContent("1 of 2 slots remaining");
    expect(card).toHaveTextContent("9Applicants");
  });

  it("searches by title or company and filters by status", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    const user = userEvent.setup();
    renderAt("/admin/vacancies");
    await screen.findByRole("heading", { name: "Cashier" });

    await user.type(screen.getByLabelText("Search title or company"), "kaba");
    await user.selectOptions(screen.getByLabelText("Status"), "open");

    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith("/admin/vacancies?search=kaba&pageSize=100&status=open"),
    );
  });

  it("shows an empty state with Create job vacancy", async () => {
    api.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    renderAt("/admin/vacancies");
    expect(await screen.findByText("No vacancies yet")).toBeInTheDocument();
  });

  it("decision 40-3: 'All statuses' sends no status (the API leaves out archived); the Archived filter asks for them", async () => {
    api.list.mockResolvedValue({ data: [CARD], meta: { total: 1 } });
    const user = userEvent.setup();
    renderAt("/admin/vacancies");
    await screen.findByRole("heading", { name: "Cashier" });
    expect(api.list).toHaveBeenCalledWith("/admin/vacancies?search=&pageSize=100");
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(within(screen.getByLabelText("Status")).getByRole("option", { name: "Archived" })).toHaveValue("archived");
    await user.selectOptions(screen.getByLabelText("Status"), "archived");
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("/admin/vacancies?search=&pageSize=100&status=archived"));
  });
});

describe("decision 40-3: Archive vacancies (bulk)", () => {
  const vac = (vacancyId, jobTitle, status, withClientCount = 0) => ({
    ...CARD, vacancyId, jobTitle, status, withClientCount, companyName: `${jobTitle} Co.`,
  });
  const CLOSED_FREE = vac("c1", "Bagger", "closed");
  const CLOSED_WITH_CLIENT = vac("c2", "Stocker", "closed", 2);
  const FILLED = vac("f1", "Barista", "filled");
  let candidates;

  beforeEach(() => {
    vi.clearAllMocks();
    candidates = { closed: [CLOSED_FREE, CLOSED_WITH_CLIENT], filled: [FILLED] };
    api.list.mockImplementation(async (path) => {
      const status = new URL(path, "http://x").searchParams.get("status");
      const rows = status ? candidates[status] ?? [] : [CARD];
      return { data: rows, meta: { total: rows.length } };
    });
  });

  async function openDialog(user) {
    renderAt("/admin/vacancies");
    await screen.findByRole("heading", { name: "Cashier" });
    await user.click(screen.getByRole("button", { name: "Archive vacancies" }));
    return screen.findByRole("dialog", { name: "Archive vacancies" });
  }
  const box = (dialog, name) => within(dialog).getByRole("checkbox", { name });

  it("lists only filled vacancies and closed ones with nobody with the client; says how many closed ones are left out", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText("Bagger")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith("/admin/vacancies?search=&pageSize=100&status=closed");
    expect(api.list).toHaveBeenCalledWith("/admin/vacancies?search=&pageSize=100&status=filled");
    // exactly three checkboxes, in this order, each named "{job} {company} {status}"
    const named = ["Select all", "Bagger Bagger Co. Closed", "Barista Barista Co. Filled"].map((name) => box(dialog, name));
    expect(within(dialog).getAllByRole("checkbox")).toEqual(named);
    expect(within(dialog).queryByText("Stocker")).not.toBeInTheDocument(); // closed, but 2 still with the client
    expect(within(dialog).getByText(/1 closed vacancy is not listed: someone is still with the client\./)).toBeInTheDocument();
    expect(within(dialog).queryByText("Cashier")).not.toBeInTheDocument(); // open: never listed
  });

  it("Archive stays disabled until something is chosen; Select all chooses every listed vacancy and clears again", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await within(dialog).findByText("Bagger");
    expect(within(dialog).getByRole("button", { name: "Archive vacancies" })).toBeDisabled();

    await user.click(box(dialog, "Bagger Bagger Co. Closed"));
    expect(within(dialog).getByRole("button", { name: "Archive 1 vacancy" })).toBeEnabled();
    await user.click(box(dialog, "Select all"));
    expect(box(dialog, "Bagger Bagger Co. Closed")).toHaveAttribute("aria-checked", "true");
    expect(box(dialog, "Barista Barista Co. Filled")).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("button", { name: "Archive 2 vacancies" })).toBeEnabled();
    await user.click(box(dialog, "Select all"));
    expect(within(dialog).getByRole("button", { name: "Archive vacancies" })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("archives the chosen ones one after another through the single route and shows a result per vacancy", async () => {
    const { ApiError } = await import("@/lib/apiClient");
    const order = [];
    api.post.mockImplementation(async (path) => {
      order.push(path);
      if (path === "/admin/vacancies/c1/archive") return { ...CLOSED_FREE, status: "archived", closeOut: { notSelected: 3, standby: 1 } };
      throw new ApiError(409, "CONFLICT", "This vacancy changed meanwhile. Refresh the page.");
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await within(dialog).findByText("Bagger");
    await user.click(box(dialog, "Select all"));
    await user.click(within(dialog).getByRole("button", { name: "Archive 2 vacancies" }));

    const results = await within(dialog).findByRole("list", { name: "Results" });
    expect(order).toEqual(["/admin/vacancies/c1/archive", "/admin/vacancies/f1/archive"]); // sequential, in list order
    expect(api.post.mock.calls.map((c) => c[1])).toEqual([{}, {}]);
    expect(within(results).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Bagger: Archived (3 not selected, 1 moved to standby).",
      "Barista: Not archived: This vacancy changed meanwhile. Refresh the page.",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Archive vacancies" })).not.toBeInTheDocument());
  });

  it("nothing to archive: says so, and the Archive button stays disabled", async () => {
    candidates = { closed: [CLOSED_WITH_CLIENT], filled: [] };
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText("No vacancies can be archived right now.")).toBeInTheDocument();
    expect(within(dialog).queryAllByRole("checkbox")).toEqual([]);
    expect(within(dialog).getByRole("button", { name: "Archive vacancies" })).toBeDisabled();
  });
});

describe("Vacancy detail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes a draft after confirmation (TC-25)", async () => {
    const published = { ...DETAIL, status: "open", editable: { full: false, postingText: true, capIncrease: true } };
    let current = DETAIL; // the API returns the new status once published
    api.get.mockImplementation(async () => current);
    api.post.mockImplementation(async () => {
      current = published;
      return { ...published, poolMatching: "started" }; // Phase 3: pool matching started in the background
    });
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");

    expect(await screen.findByRole("heading", { name: "Cashier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Pool invitations" })).not.toBeInTheDocument(); // a draft has none
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("A. Communication and Interpersonal Skills")).toBeInTheDocument();
    expect(screen.getByText("Experience · Education / Training · Technical Skills")).toBeInTheDocument();
    expect(screen.getByText("C. Job Specific Skills and Experience").closest("tr")).toHaveTextContent("40%");
    expect(screen.getByText("Required skills")).toBeInTheDocument();
    expect(screen.queryByText("Minimum years of experience")).not.toBeInTheDocument(); // decision 11 (old row still sends 1)
    // decision 35: one name for the group, as on the form
    const selection = screen.getByRole("heading", { name: "Selection Settings", level: 2 }).closest("section");
    expect(within(selection).getByText("Slots needed")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Publish Cashier?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/publish", {}));
    expect(toast.success).toHaveBeenCalledWith("Vacancy published. Pool matching is running: see Pool invitations.");
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Pool invitations" })).toBeInTheDocument();
  });

  describe("Pool invitations tab (Phase 3, decision 17d)", () => {
    const OPEN = { ...DETAIL, status: "open", editable: { full: false, postingText: true, capIncrease: true } };
    const INVITES = {
      running: false,
      poolMatchedAt: "2030-10-18T01:00:00.000Z",
      summary: { invited: 2, skipped: 3, failed: 1, finishedAt: "2030-10-18T01:00:00.000Z" },
      invitations: [
        { invitationId: "i1", applicantName: "Ana Cruz", status: "pending", matchingScore: 71.15, invitedAt: "2030-10-18T00:30:00.000Z", dueAt: "2030-10-21T00:30:00.000Z", respondedAt: null, applicationId: null },
        { invitationId: "i2", applicantName: "Ben Reyes", status: "accepted", matchingScore: 64.2, invitedAt: "2030-10-18T00:30:00.000Z", dueAt: "2030-10-21T00:30:00.000Z", respondedAt: "2030-10-18T02:00:00.000Z", applicationId: "a9" },
      ],
    };
    let invites;
    beforeEach(() => {
      invites = INVITES;
      api.get.mockImplementation(async (path) => (path === "/admin/vacancies/v1/invitations" ? invites : OPEN));
    });

    it("shows the last run and each invitation with its status, matching, and dates", async () => {
      const user = userEvent.setup();
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("tab", { name: "Pool invitations" }));
      expect(await screen.findByText("Ana Cruz")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Last run Oct 18, 2030, 9:00 AM (Philippine time): 2 invited, 3 skipped, 1 failed.");
      const [, ana, ben] = screen.getAllByRole("row");
      expect(within(ana).getAllByRole("cell").map((c) => c.textContent)).toEqual([
        "Ana Cruz", "Waiting for the applicant", "Resume71.15%", "Oct 18, 2030, 8:30 AM", "—",
      ]);
      expect(within(ben).getAllByRole("cell")[1]).toHaveTextContent("Accepted");
      expect(api.get).toHaveBeenCalledWith("/admin/vacancies/v1/invitations");
    });

    it("Run pool matching again posts (no body) and confirms", async () => {
      const user = userEvent.setup();
      api.post.mockResolvedValue({ status: "started" });
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("tab", { name: "Pool invitations" }));
      await user.click(await screen.findByRole("button", { name: "Run pool matching again" }));
      expect(api.post.mock.calls).toEqual([["/admin/vacancies/v1/pool-matching"]]);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pool matching started. The results appear here when it finishes."));
    });

    it("while a run is going: 'running' and the button is disabled", async () => {
      const user = userEvent.setup();
      invites = { ...INVITES, running: true };
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("tab", { name: "Pool invitations" }));
      expect(await screen.findByText("Pool matching is running…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run pool matching again" })).toBeDisabled();
    });

    it("never run, and no Run again for a job that is not open", async () => {
      const user = userEvent.setup();
      invites = { running: false, poolMatchedAt: null, summary: null, invitations: [] };
      api.get.mockImplementation(async (path) => (path === "/admin/vacancies/v1/invitations" ? invites : { ...OPEN, status: "closed" }));
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("tab", { name: "Pool invitations" }));
      expect(await screen.findByText("Pool matching has not run for this job yet.")).toBeInTheDocument();
      expect(screen.getByText("No invitations yet")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Run pool matching again" })).not.toBeInTheDocument();
    });
  });

  it("asks for a higher cap to reopen a vacancy at its cap (FR-VAC-07)", async () => {
    api.get.mockResolvedValue({
      ...DETAIL,
      status: "closed",
      applicationCount: 16,
      editable: { full: false, postingText: true, capIncrease: true },
    });
    api.post.mockResolvedValue({ ...DETAIL, status: "open", applicationCap: 20 });
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");

    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Raise the application cap to reopen/)).toBeInTheDocument();

    const cap = within(dialog).getByLabelText("New application cap");
    await user.clear(cap);
    await user.type(cap, "16");
    await user.click(within(dialog).getByRole("button", { name: "Raise cap and reopen" }));
    expect(within(dialog).getByText("Use more than 16 (the qualified applications so far)")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(cap);
    await user.type(cap, "20");
    await user.click(within(dialog).getByRole("button", { name: "Raise cap and reopen" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/reopen", { applicationCap: 20 }));
  });

  describe("Archive (BR-22 close-out, S15)", () => {
    const closed = { ...DETAIL, status: "closed", editable: { full: false, postingText: true, capIncrease: true } };
    let ranking;

    beforeEach(() => {
      ranking = [{ status: "passed" }, { status: "passed_awaiting_confirmation" }, { status: "did_not_pass" }];
      api.get.mockImplementation(async (path) => {
        if (path === "/admin/vacancies/v1") return closed;
        if (path === "/admin/screening/v1") {
          return {
            groups: {
              experienced: { shortlisted: [{ applicationId: "s1" }], waitingPool: [{ applicationId: "w1" }, { applicationId: "w2" }] },
              first_time: { shortlisted: [], waitingPool: [] },
            },
          };
        }
        if (path === "/admin/interviews?vacancyId=v1") return [{ applicationStatus: "interview_scheduled" }];
        if (path === "/admin/vacancies/v1/ranking") return { vacancy: {}, ranking };
        throw new Error(`unexpected ${path}`);
      });
    });

    it("states what the close-out does with counts, and archives with the counts in the toast", async () => {
      api.post.mockResolvedValue({ ...closed, status: "archived", closeOut: { notSelected: 4, standby: 2 } });
      const user = userEvent.setup();
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("button", { name: "Archive" }));
      const dialog = await screen.findByRole("dialog", { name: "Archive Cashier?" });

      // 1 shortlisted + 2 waiting + 1 interview scheduled → not selected; passed + notified → standby
      const items = await within(dialog).findAllByRole("listitem");
      expect(items.map((li) => li.textContent)).toEqual([
        "4 applicants in the waiting pool, screening, or interview → Not selected",
        "2 passed applicants (incl. notified or confirmed) → Standby",
      ]);
      expect(within(dialog).getByText(/Everyone moved is notified and kept in the applicant pool\. They are not blocked/)).toBeInTheDocument();
      expect(within(dialog).getByText("Archiving is refused while any applicant is endorsed (none now).")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Archive" }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/archive", {}));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vacancy archived: 4 not selected, 2 moved to standby."));
    });

    it("an endorsed applicant: the dialog says archiving is refused, and the API's 409 is shown", async () => {
      ranking = [...ranking, { status: "endorsed" }];
      const { ApiError } = await import("@/lib/apiClient");
      api.post.mockRejectedValue(new ApiError(409, "BUSINESS_RULE", "Record the client's decision for every endorsed applicant before archiving this vacancy."));
      const user = userEvent.setup();
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("button", { name: "Archive" }));
      const dialog = await screen.findByRole("dialog", { name: "Archive Cashier?" });
      expect(await within(dialog).findByText(/1 applicant is endorsed and waiting for the client's decision: archiving is refused/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Archive" }));
      expect(await within(dialog).findByText("Record the client's decision for every endorsed applicant before archiving this vacancy.")).toBeInTheDocument();
    });

    it("decision 40-3: a filled vacancy has Archive; nothing else changes (no close-out preview), plain toast", async () => {
      const filled = { ...closed, status: "filled" };
      api.get.mockImplementation(async (path) => {
        if (path === "/admin/vacancies/v1") return filled;
        throw new Error(`unexpected ${path}`); // no screening / interviews / ranking preview for a filled vacancy
      });
      api.post.mockResolvedValue({ ...filled, status: "archived", closeOut: { notSelected: 0, standby: 0 } });
      const user = userEvent.setup();
      renderAt("/admin/vacancies/v1");
      await user.click(await screen.findByRole("button", { name: "Archive" }));
      const dialog = await screen.findByRole("dialog", { name: "Archive Cashier?" });
      expect(within(dialog).getByText(/It is already filled, so nothing else changes: deployed applicants and every application stay as they are\./)).toBeInTheDocument();
      expect(within(dialog).queryByText(/closes out every open application/)).not.toBeInTheDocument();
      expect(within(dialog).queryAllByRole("listitem")).toEqual([]);
      await user.click(within(dialog).getByRole("button", { name: "Archive" }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/archive", {}));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vacancy archived"));
      expect(api.get.mock.calls.map((c) => c[0]).every((p) => p === "/admin/vacancies/v1")).toBe(true);
    });
  });

  describe("decision 40-5: Unarchive", () => {
    const archived = { ...DETAIL, status: "archived", postedAt: "2026-10-20T01:00:00.000Z", editable: { full: false, postingText: false, capIncrease: false } };

    it("an archived vacancy has Unarchive only; the dialog says nothing else is restored; the toast names the new status", async () => {
      api.get.mockImplementation(async (path) => {
        if (path === "/admin/vacancies/v1") return archived;
        throw new Error(`unexpected ${path}`); // no close-out preview
      });
      api.post.mockResolvedValue({ ...archived, status: "closed" });
      const user = userEvent.setup();
      renderAt("/admin/vacancies/v1");
      const unarchive = await screen.findByRole("button", { name: "Unarchive" });
      for (const name of ["Publish", "Close", "Reopen", "Archive"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      await user.click(unarchive);

      const dialog = await screen.findByRole("dialog", { name: "Unarchive Cashier?" });
      expect(
        within(dialog).getByText(
          "It goes back to Closed (Filled if its Deployed applicants already fill the slots, Draft if it was never published). It is not opened: reopen it afterwards if you need applicants. Nothing else is restored: applicants moved when it was archived stay Not selected or Standby, and expired invitations stay expired. No one is notified.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).queryAllByRole("listitem")).toEqual([]);
      await user.click(within(dialog).getByRole("button", { name: "Unarchive" }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/unarchive", {}));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vacancy unarchived: now Closed."));
      expect(api.get.mock.calls.map((c) => c[0]).every((p) => p === "/admin/vacancies/v1")).toBe(true);
    });

    it.each(["draft", "open", "closed", "endorsing", "filled"])("a %s vacancy has no Unarchive button", async (status) => {
      api.get.mockImplementation(async (path) => {
        if (path === "/admin/vacancies/v1") return { ...DETAIL, status };
        return { vacancy: {}, ranking: [] };
      });
      renderAt("/admin/vacancies/v1");
      expect(await screen.findByRole("heading", { name: "Cashier" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Unarchive" })).not.toBeInTheDocument();
    });
  });

  it("shows the ranking placeholder tab", async () => {
    api.get.mockResolvedValue(DETAIL);
    const user = userEvent.setup();
    renderAt("/admin/vacancies/v1");
    await user.click(await screen.findByRole("tab", { name: "Ranking" }));
    expect(screen.getByText("No ranking yet")).toBeInTheDocument();
  });
});
