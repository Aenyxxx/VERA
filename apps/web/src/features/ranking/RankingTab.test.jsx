// Final ranking tab (S15; FR-END-01, FR-END-03, FR-VAC-06; TC-50, TC-52): the API's order, both groups, score chips,
// checkboxes on passed rows only, capped at the places left with the top passed preselected, the Notify dialog (fixed
// title, editable body from notifyMessageDefault, automatic confirm-by line) and a 422 shown in it, and the breakdown.
import { notifyMessageDefault } from "@vera/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), download: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { RankingTab } = await import("./RankingTab");

const entry = (overrides) => ({
  applicationId: "a1",
  applicantName: "Ana Cruz",
  applicantType: "experienced",
  status: "passed",
  appliedAt: "2030-10-08T01:00:00.000Z",
  actionDueAt: null,
  matchingScore: 79.31,
  interviewScore: 77.5,
  finalScore: 78.41,
  passingScore: 75,
  passed: true,
  overallRating: 4,
  reused: false,
  ...overrides,
});

let data;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RankingTab vacancyId="v1" />
    </QueryClientProvider>,
  );
}

const rowOf = async (name) => (await screen.findByText(name)).closest("tr");

/** Decision 32: the client's final interview in the Notify dialog (Philippine time). */
async function fillFinalInterview(dialog) {
  const user = userEvent.setup();
  await user.type(within(dialog).getByLabelText("Date"), "2030-10-16");
  await user.type(within(dialog).getByLabelText("Time"), "09:30");
  await user.type(within(dialog).getByLabelText("Location and details"), "Bring two valid IDs.");
}
const box = (name) => screen.getByRole("checkbox", { name: `Select ${name}` });

beforeEach(() => {
  vi.clearAllMocks();
  data = {
    vacancy: { vacancyId: "v1", jobTitle: "Cashier", companyName: "Kabayan Mart", status: "open", slotsNeeded: 1, endorsementCount: 2, committed: 0, notifyRemaining: 2, canNotify: true },
    ranking: [
      entry({ rank: 1, applicationId: "b", applicantName: "Ben Reyes", applicantType: "first_time", matchingScore: 87.5, finalScore: 82.5 }),
      entry({ rank: 2, applicationId: "a", applicantName: "Ana Cruz" }),
      entry({ rank: 3, applicationId: "c", applicantName: "Cora Lim", finalScore: 76.67, interviewScore: 76.67, matchingScore: 76.67, reused: true }),
      entry({ rank: 4, applicationId: "d", applicantName: "Dan Uy", status: "did_not_pass", passed: false, finalScore: 55, interviewScore: 50, matchingScore: 60, overallRating: 3 }),
      entry({ rank: 5, applicationId: "e", applicantName: "Eva Sy", status: "passed_awaiting_confirmation", finalScore: 75.1, actionDueAt: "2030-10-13T06:00:00.000Z" }),
    ],
  };
  api.get.mockImplementation(async (path) => {
    if (path === "/admin/vacancies/v1/ranking") return data;
    throw new Error(`unexpected ${path}`);
  });
});

describe("Final ranking tab", () => {
  it("TC-50: one combined list in the API's order with group, status, score chips, overall rating, and confirm-by", async () => {
    renderTab();
    const ben = await rowOf("Ben Reyes");
    const table = ben.closest("table");
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[2].querySelector("span").textContent);
    expect(names).toEqual(["Ben Reyes", "Ana Cruz", "Cora Lim", "Dan Uy", "Eva Sy"]);

    expect(within(ben).getByText("First-time")).toBeInTheDocument();
    expect(within(ben).getByText("87.50%")).toBeInTheDocument();
    expect(within(ben).getByText("82.50%")).toBeInTheDocument();
    expect(within(ben).getByText("Passed")).toBeInTheDocument();
    expect(within(ben).getByText("Good")).toBeInTheDocument(); // overall rating 4
    const cora = await rowOf("Cora Lim");
    expect(within(cora).getByText("Experienced · reused ratings")).toBeInTheDocument();
    const eva = await rowOf("Eva Sy");
    expect(within(eva).getByText("Awaiting confirmation")).toBeInTheDocument();
    expect(within(eva).getByText("Oct 13, 2030, 2:00 PM")).toBeInTheDocument();
  });

  it("checkboxes only on passed rows; the top passed are preselected up to the places left; the cap disables the rest", async () => {
    renderTab();
    await rowOf("Ben Reyes");
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Select Ben Reyes",
      "Select Ana Cruz",
      "Select Cora Lim",
    ]);
    expect(box("Ben Reyes")).toBeChecked();
    expect(box("Ana Cruz")).toBeChecked();
    expect(box("Cora Lim")).toHaveAttribute("data-disabled"); // 2 of 2 already selected
    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText(/^Places left in the endorsement: 2 of 2/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(box("Ana Cruz"));
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    await user.click(box("Cora Lim")); // a place is free again, so Cora can now be selected
    expect(box("Cora Lim")).toBeChecked();
    expect(screen.getByRole("button", { name: "Notify (2)" })).toBeEnabled();
  });

  it("TC-52: the Notify dialog has the title, the default body, no helper notes (decision 35), and posts the selection", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ notified: ["a", "b"], actionDueAt: "2030-10-13T06:00:00.000Z", remaining: 0 });
    renderTab();
    await rowOf("Ben Reyes");
    await user.click(screen.getByRole("button", { name: "Notify (2)" }));

    const dialog = await screen.findByRole("dialog", { name: "Notify 2 applicants for endorsement?" });
    expect(within(dialog).getByText("Please confirm: Cashier")).toBeInTheDocument();
    expect(within(dialog).getByText("Notification title")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Message")).toHaveValue(notifyMessageDefault("Cashier"));
    expect(within(dialog).getByLabelText("Location and details")).toBeInTheDocument();
    // decision 35: the "(fixed)" / "(no company name)" labels and the helper note are gone (the API check stays)
    expect(within(dialog).queryByText(/\(fixed\)|no company name/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/added automatically|Don't name the company/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/^Ben Reyes, Ana Cruz will be asked to confirm/)).toBeInTheDocument();

    // decision 32: the client's final interview (Philippine time) and the details are part of what they confirm
    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Notify applicants" }));
    expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/notify", {
      applicationIds: ["b", "a"],
      message: notifyMessageDefault("Cashier"),
      finalInterviewAt: "2030-10-16T09:30:00+08:00",
      finalInterviewDetails: "Bring two valid IDs.",
    });
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Notified 2 applicants. They can confirm until Oct 13, 2030, 2:00 PM (Philippine time)."),
    );
  });

  it("an edited body naming the company: the API's 422 is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(422, "BUSINESS_RULE", "Remove the company name: applicants never see the client company."));
    renderTab();
    await rowOf("Ben Reyes");
    await user.click(screen.getByRole("button", { name: "Notify (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Notify 2 applicants for endorsement?" });
    const message = within(dialog).getByLabelText("Message");
    await user.clear(message);
    await user.type(message, "You will be endorsed to Kabayan Mart.");
    await fillFinalInterview(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Notify applicants" }));
    expect(api.post).toHaveBeenCalledWith("/admin/vacancies/v1/notify", {
      applicationIds: ["b", "a"],
      message: "You will be endorsed to Kabayan Mart.",
      finalInterviewAt: "2030-10-16T09:30:00+08:00",
      finalInterviewDetails: "Bring two valid IDs.",
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Remove the company name: applicants never see the client company.");
  });

  it("decision 32: the final interview date, time, and details are required before sending", async () => {
    const user = userEvent.setup();
    renderTab();
    await rowOf("Ben Reyes");
    await user.click(screen.getByRole("button", { name: "Notify (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Notify 2 applicants for endorsement?" });
    expect(within(dialog).getByText("Final interview with the client (Philippine time)")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Notify applicants" }));
    expect(within(dialog).getByText("Enter the date and the time.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the final interview details.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");

    await user.type(within(dialog).getByLabelText("Date"), "2030-10-16");
    await user.type(within(dialog).getByLabelText("Time"), "09:30");
    await user.type(within(dialog).getByLabelText("Location and details"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Notify applicants" }));
    expect(within(dialog).queryByText("Enter the date and the time.")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Enter the final interview details.")).toBeInTheDocument(); // blanks are not details
    expect(api.post).toHaveBeenCalledTimes(0);
  });

  it("decision 33: Download only on passed rows at passed or later (PACKET_STATUSES); never on did_not_pass or standby", async () => {
    data.ranking.push(
      entry({ rank: 6, applicationId: "f", applicantName: "Fe Go", status: "standby", finalScore: 75.05 }), // passed, then standby
      entry({ rank: 7, applicationId: "g", applicantName: "Gil Tan", status: "hired", finalScore: 75.01 }),
      entry({ rank: 8, applicationId: "h", applicantName: "Hal Ong", status: "not_hired", finalScore: 75 }),
    );
    renderTab();
    await rowOf("Ben Reyes");
    expect(screen.getAllByRole("button", { name: /endorsement packet$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Download Ben Reyes's endorsement packet",
      "Download Ana Cruz's endorsement packet",
      "Download Cora Lim's endorsement packet",
      "Download Eva Sy's endorsement packet", // awaiting confirmation
      "Download Gil Tan's endorsement packet", // hired
      "Download Hal Ong's endorsement packet", // not hired
    ]);
    expect(within(await rowOf("Dan Uy")).queryByRole("button", { name: /endorsement packet/ })).toBeNull(); // did not pass
    expect(within(await rowOf("Fe Go")).queryByRole("button", { name: /endorsement packet/ })).toBeNull(); // standby
  });

  it("decision 33: Download saves the PDF from the route by application; an error is toasted", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["%PDF-"], { type: "application/pdf" });
    URL.createObjectURL = vi.fn(() => "blob:packet");
    URL.revokeObjectURL = vi.fn();
    api.download.mockResolvedValueOnce({ blob, filename: "Cruz_Ana_Cashier_Endorsement.pdf" });
    renderTab();
    const button = await screen.findByRole("button", { name: "Download Ana Cruz's endorsement packet" });
    expect(button).toHaveTextContent("Download");
    await user.click(button);
    expect(api.download).toHaveBeenCalledWith("/admin/applications/a/packet");
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:packet");

    api.download.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Only an applicant who passed the assessment can get an endorsement packet."));
    await user.click(screen.getByRole("button", { name: "Download Ana Cruz's endorsement packet" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only an applicant who passed the assessment can get an endorsement packet."));
  });

  it("a too-short body is caught before sending", async () => {
    const user = userEvent.setup();
    renderTab();
    await rowOf("Ben Reyes");
    await user.click(screen.getByRole("button", { name: "Notify (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Notify 2 applicants for endorsement?" });
    await user.clear(within(dialog).getByLabelText("Message"));
    await user.type(within(dialog).getByLabelText("Message"), "Hi");
    await user.click(within(dialog).getByRole("button", { name: "Notify applicants" }));
    expect(within(dialog).getByText("Write at least 10 characters.")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(0);
  });

  it("an archived vacancy: Notify closed with the reason; the ranking stays as a record", async () => {
    data.vacancy = { ...data.vacancy, status: "archived", canNotify: false };
    renderTab();
    await rowOf("Ben Reyes");
    expect(screen.getByText("Notify is closed for this vacancy")).toBeInTheDocument();
    expect(screen.getByText("This vacancy is archived; its applicants can no longer be notified.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Notify/ })).toBeDisabled();
  });

  it("the breakdown shows matched/missing skills, sections × weights, the overall rating, and the final formula", async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path) => {
      if (path === "/admin/vacancies/v1/ranking") return data;
      if (path === "/admin/applications/a") {
        return { matching: { matchingScore: 79.31, skillsScore: 87.5, experienceScore: 71.11, weights: { skills: 0.5, experience: 0.5 }, matchedSkills: ["Handling cash"], missingSkills: ["Balancing the drawer"] } };
      }
      if (path === "/admin/applications/a/evaluation") {
        return {
          sections: [
            { sectionCode: "A", sectionName: "Communication and Interpersonal Skills", weight: 30, items: [] },
            { sectionCode: "B", sectionName: "Personal Effectiveness Skills and Traits", weight: 30, items: [] },
            { sectionCode: "C", sectionName: "Job Specific Skills and Experience", weight: 40, items: [] },
          ],
          evaluation: {
            sectionScores: { A: 83.33, B: 75, C: 75 }, interviewScore: 77.5, overallRating: 4, matchingScore: 79.31,
            finalScore: 78.41, passingScore: 75, passed: true, reused: false, source: null, ratings: [],
          },
        };
      }
      throw new Error(`unexpected ${path}`);
    });
    renderTab();
    await rowOf("Ana Cruz");
    await user.click(screen.getByRole("button", { name: "Score breakdown for Ana Cruz" }));
    const dialog = await screen.findByRole("dialog", { name: "Score breakdown: Ana Cruz" });
    expect(await within(dialog).findByText(/Handling cash/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Balancing the drawer/)).toBeInTheDocument();
    const rowA = within(dialog).getByText("A. Communication and Interpersonal Skills").closest("tr");
    expect(within(rowA).getByText("83.33%")).toBeInTheDocument();
    expect(within(rowA).getByText("30%")).toBeInTheDocument();
    expect(within(rowA).getByText("25.00")).toBeInTheDocument();
    expect(within(dialog).getByText(/Good probability of success \(60–80%\)/)).toBeInTheDocument();
    expect(within(dialog).getByText((_, el) => el?.tagName === "P" && el.textContent === "(79.31% + 77.50%) ÷ 2 = 78.41%")).toBeInTheDocument();
  });

  it("no evaluated applicants: the empty state", async () => {
    data.ranking = [];
    renderTab();
    expect(await screen.findByText("No ranking yet")).toBeInTheDocument();
  });
});
