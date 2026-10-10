// Interview Assessment evaluation page (S14; FR-INT-06, BR-21; TC-48, TC-49): the 15 Competency Profile items grouped
// A/B/C with section weights and rating interpretations, the live preview from @vera/shared (worked example 77.50),
// Save only when all 15 are rated and the API allows it (ratings only in the body), and the read-only reused view.
import { COMPETENCY_SECTIONS } from "@vera/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: InterviewEvaluation } = await import("./InterviewEvaluation");

const WEIGHTS = { A: 30, B: 30, C: 40 };
const SECTIONS = COMPETENCY_SECTIONS.map((s) => ({
  sectionCode: s.code,
  sectionName: s.name,
  weight: WEIGHTS[s.code],
  items: s.items.map((name, i) => ({ competencyId: `${s.code}${i + 1}`, competencyName: name })),
}));
const ITEMS = SECTIONS.flatMap((s) => s.items);
// ALGORITHM.md §6 worked example: A = 5, 4, 4 · B = 4, 4, 4, 4, 5, 4, 3, 4, 4 · C = 4, 4, 4
const WORKED = [5, 4, 4, 4, 4, 4, 4, 5, 4, 3, 4, 4, 4, 4, 4];

const page = (overrides = {}) => ({
  application: {
    applicationId: "a1",
    status: "interview_confirmed",
    applicantType: "experienced",
    applicantName: "Ana Cruz",
    matchingScore: 79.31,
    passingScore: 75,
  },
  vacancy: { vacancyId: "v1", jobTitle: "Cashier", companyName: "Kabayan Mart" },
  sections: SECTIONS,
  interview: { interviewId: "i1", status: "confirmed", scheduledAt: "2026-10-10T02:00:00.000Z", started: true },
  evaluation: null,
  canEvaluate: true,
  blockedReason: null,
  ...overrides,
});

let data;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/admin/interviews/:vacancyId/:applicationId", element: <InterviewEvaluation /> }],
    { initialEntries: ["/admin/interviews/v1/a1"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const section = (code) => screen.getByRole("region", { name: new RegExp(`^${code}\\. `) });
const itemGroup = (name) => screen.getByRole("radiogroup", { name });
const choice = (itemName, n) => within(itemGroup(itemName)).getByRole("radio", { name: new RegExp(`^${n} `) });
const summary = () => screen.getByRole("region", { name: "Ana Cruz" });
const saveButton = () => screen.getByRole("button", { name: "Save evaluation" });

async function rate(user, ratings) {
  for (const [i, item] of ITEMS.entries()) {
    if (ratings[i] != null) await user.click(choice(item.competencyName, ratings[i]));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  data = page();
  api.get.mockImplementation(async (path) => {
    if (path === "/admin/applications/a1/evaluation") return data;
    throw new Error(`unexpected ${path}`);
  });
});

describe("Interview Assessment evaluation page", () => {
  it("groups the 15 items into A (3) / B (9) / C (3) with the section weights and interpretations on each choice", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Interview Assessment" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/admin/applications/a1/evaluation");

    expect(within(section("A")).getAllByRole("radiogroup")).toHaveLength(3);
    expect(within(section("B")).getAllByRole("radiogroup")).toHaveLength(9);
    expect(within(section("C")).getAllByRole("radiogroup")).toHaveLength(3);
    expect(within(section("A")).getByText("Weight 30%")).toBeInTheDocument();
    expect(within(section("B")).getByText("Weight 30%")).toBeInTheDocument();
    expect(within(section("C")).getByText("Weight 40%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A. Communication and Interpersonal Skills" })).toBeInTheDocument();

    // every item offers 1–5, each with its interpretation
    const oral = within(itemGroup("Oral Communication/Listening")).getAllByRole("radio");
    expect(oral.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "false", "false", "false", "false"]);
    expect(choice("Oral Communication/Listening", 1)).toHaveAccessibleName("1 Does not achieve expectations");
    expect(choice("Oral Communication/Listening", 5)).toHaveAccessibleName("5 Greatly exceeds expectations");
    expect(within(summary()).getByText("79.31%")).toBeInTheDocument(); // matching slot
  });

  it("TC-48: the worked example previews 83.33 / 75 / 75 → interview 77.50, overall rating 4, final 78.41", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });
    await rate(user, WORKED);

    expect(within(section("A")).getByText("Section score 83.33%")).toBeInTheDocument();
    expect(within(section("B")).getByText("Section score 75.00%")).toBeInTheDocument();
    expect(within(section("C")).getByText("Section score 75.00%")).toBeInTheDocument();
    expect(within(summary()).getByText("77.50%")).toBeInTheDocument(); // interview
    expect(within(summary()).getByText("78.41%")).toBeInTheDocument(); // final
    expect(within(summary()).getByText(/Good probability of success \(60–80%\)/)).toBeInTheDocument();
    expect(within(summary()).getByText("Passes with these ratings")).toBeInTheDocument();
  });

  it("a section score appears only once all its items are rated", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });
    await user.click(choice("Oral Communication/Listening", 5));
    await user.click(choice("Co-Worker Relations/Teamwork", 4));
    expect(within(section("A")).getByText("Section score – rate all 3 items")).toBeInTheDocument();
    await user.click(choice("Customer Relations", 4));
    expect(within(section("A")).getByText("Section score 83.33%")).toBeInTheDocument();
  });

  it("TC-49: Save stays disabled until all 15 are rated; then it confirms and posts the ratings only", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ applicationId: "a1", status: "passed", finalScore: 78.41, passed: true });
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });

    await rate(user, WORKED.slice(0, 14));
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Rate all 15 items to save (14 of 15 rated).")).toBeInTheDocument();

    await user.click(choice("Technical Skills", 4));
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("The ratings cannot be changed after saving.")).toBeInTheDocument();

    await user.click(saveButton());
    const dialog = await screen.findByRole("dialog", { name: "Save the evaluation for Ana Cruz?" });
    expect(within(dialog).getByText(/^Final score 78\.41%: the applicant passes Cashier\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save evaluation" }));

    await vi.waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/applications/a1/evaluation", {
        ratings: ITEMS.map((item, i) => ({ competencyId: item.competencyId, rating: WORKED[i] })),
      }),
    );
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Evaluation saved: passed"));
  });

  it("below the passing score: the confirm states the consequence with the company", async () => {
    const user = userEvent.setup();
    data = page({ application: { ...page().application, passingScore: 80 } });
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });
    await rate(user, WORKED);
    expect(within(summary()).getByText("Below the passing score with these ratings")).toBeInTheDocument();
    await user.click(saveButton());
    const dialog = await screen.findByRole("dialog", { name: "Save the evaluation for Ana Cruz?" });
    expect(within(dialog).getByText(/below the passing score: .* can no longer apply to Kabayan Mart's jobs\./)).toBeInTheDocument();
  });

  it("before the interview time: Save disabled with the API's reason even when all items are rated", async () => {
    const user = userEvent.setup();
    data = page({ canEvaluate: false, blockedReason: "The interview has not started yet." });
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });
    await rate(user, WORKED);
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("The interview has not started yet.")).toBeInTheDocument();
  });

  it("a race answered with 409 shows the API message in the confirm dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "Only a confirmed interview can be evaluated. Refresh the page."));
    renderPage();
    await screen.findByRole("heading", { name: "Interview Assessment" });
    await rate(user, WORKED);
    await user.click(saveButton());
    const dialog = await screen.findByRole("dialog", { name: "Save the evaluation for Ana Cruz?" });
    await user.click(within(dialog).getByRole("button", { name: "Save evaluation" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only a confirmed interview can be evaluated. Refresh the page.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reused ratings (BR-21): the banner names the source, the original ratings are read-only, the stored scores show", async () => {
    data = page({
      application: { ...page().application, status: "passed", matchingScore: 80 },
      vacancy: { vacancyId: "v2", jobTitle: "Store Crew", companyName: "ClayGo" },
      sections: SECTIONS.map((s) => ({ ...s, weight: { A: 20, B: 80, C: 0 }[s.sectionCode] })),
      interview: null,
      canEvaluate: false,
      blockedReason: "This application already has an evaluation.",
      evaluation: {
        ratings: ITEMS.map((item, i) => ({ competencyId: item.competencyId, rating: WORKED[i] })),
        sectionScores: { A: 83.33, B: 75, C: 75 },
        interviewScore: 76.67,
        overallRating: 4,
        matchingScore: 80,
        finalScore: 78.34,
        passingScore: 75,
        passed: true,
        computedAt: "2026-10-10T05:00:00.000Z",
        reused: true,
        source: { applicationId: "a0", jobTitle: "Cashier", companyName: "Kabayan Mart", ratedAt: "2026-10-09T01:00:00.000Z" },
      },
    });
    renderPage();
    expect(await screen.findByText(/^Ratings from Cashier \(Kabayan Mart\), Oct 9, 2026, 9:00 AM\./)).toBeInTheDocument();

    const oralFive = choice("Oral Communication/Listening", 5);
    expect(oralFive).toBeChecked();
    expect(oralFive).toHaveAttribute("aria-disabled", "true");
    expect(choice("Stress Tolerance", 3)).toBeChecked();
    expect(within(section("B")).getByText("Weight 80%")).toBeInTheDocument();
    expect(within(section("A")).getByText("Section score 83.33%")).toBeInTheDocument();
    expect(within(summary()).getByText("76.67%")).toBeInTheDocument();
    expect(within(summary()).getByText("78.34%")).toBeInTheDocument();
    expect(within(summary()).getByText("Passed")).toBeInTheDocument(); // the application status badge
    expect(within(summary()).getByText("Final score meets the passing score")).toBeInTheDocument();
    expect(within(summary()).getByText("No interview (reused ratings)")).toBeInTheDocument();
  });

  it("an unknown application shows the not-found state with a way back", async () => {
    api.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Application not found."));
    renderPage();
    expect(await screen.findByText("Application not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interviews Assessment" })).toHaveAttribute("href", "/admin/interviews/v1");
  });
});
