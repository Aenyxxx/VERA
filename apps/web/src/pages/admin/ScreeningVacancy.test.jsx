// Resume Screening web (FR-SCR-01..06; TC-37, TC-38, TC-39, TC-42, TC-99): vacancy list, groups, markers,
// review sheet actions, disabled next steps, and the Drop consequence.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The schedule dialog defaults the interviewer to the signed-in HR user.
vi.mock("@/hooks/useMe", () => ({ useMe: () => ({ data: { userId: "hr1", role: "hr" }, isLoading: false }) }));

const { api } = await import("@/lib/apiClient");
const { default: Screening } = await import("./Screening");
const { default: ScreeningVacancy } = await import("./ScreeningVacancy");

const V = "v1";
const entry = (overrides) => ({
  applicationId: "a1",
  applicantName: "Juan Dela Cruz",
  matchingScore: 79.31,
  appliedAt: "2026-10-08T01:00:00.000Z",
  locked: false,
  ratingsOnFile: false,
  documentsVerified: 1,
  documentsTotal: 1,
  resumeStatus: "verified",
  newUploads: 0,
  pendingRequests: 0,
  fullyVerified: true,
  ...overrides,
});
const VIEW = {
  vacancy: { vacancyId: V, jobTitle: "Cashier", companyName: "Kabayan Mart", status: "open", slotsNeeded: 2, quota: 4 },
  groups: {
    experienced: {
      quota: 4,
      shortlisted: [entry({ locked: true }), entry({ applicationId: "a2", applicantName: "Ana Cruz", newUploads: 1, fullyVerified: false })],
      waitingPool: [entry({ applicationId: "a3", applicantName: "Ben Reyes", matchingScore: 60 })],
    },
    first_time: { quota: 4, shortlisted: [entry({ applicationId: "a4", applicantName: "Cora Lim", ratingsOnFile: true })], waitingPool: [] },
  },
  notShortlisted: {
    prescreenFailed: [{ applicationId: "a5", applicantName: "Dan Uy", applicantType: "experienced", reason: "Age must be between 18 and 35 (you are 40)." }],
    belowThreshold: [{ applicationId: "a6", applicantName: "Eva Sy", applicantType: "first_time", matchingScore: 21.4, reason: "Matching score 21.4 is below the threshold 40." }],
  },
};
const sheet = (overrides = {}) => ({
  application: { applicationId: "a1", status: "shortlisted", applicantType: "experienced", locked: true },
  vacancy: { vacancyId: V, jobTitle: "Cashier", companyName: "Kabayan Mart" },
  applicant: { firstName: "Juan", lastName: "Dela Cruz", email: "juan@vera.test", age: 24, gender: "male", educationLevel: "senior_high" },
  matching: { matchingScore: 79.31, skillsScore: 87.5, experienceScore: 71.11, weights: { skills: 0.5, experience: 0.5 }, matchedSkills: ["Handling cash"], missingSkills: [] },
  resume: { resumeId: "r1", fileName: "Juan.pdf", fileSizeBytes: 2048, uploadedAt: "2026-10-07T01:00:00Z", verificationStatus: "pending" },
  documents: [
    { documentId: "d1", documentType: "nbi_clearance", fileName: "NBI.pdf", fileSizeBytes: 1024, uploadedAt: "2026-10-08T01:00:00Z", verificationStatus: "pending", newUpload: true },
  ],
  requests: [],
  fullyVerified: false,
  nextStep: null,
  reusableEvaluation: null,
  ...overrides,
});

let review;

/** The review sheet once its data has loaded (the sheet opens first with a skeleton). */
async function openSheet() {
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Cashier · Kabayan Mart");
  return dialog;
}

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/screening", element: <Screening /> },
      { path: "/admin/screening/:vacancyId", element: <ScreeningVacancy /> },
      { path: "/admin/screening/:vacancyId/:applicationId", element: <ScreeningVacancy /> },
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

beforeEach(() => {
  vi.clearAllMocks();
  review = sheet();
  api.get.mockImplementation(async (path) => {
    if (path === "/admin/screening") return [{ vacancyId: V, jobTitle: "Cashier", companyName: "Kabayan Mart", status: "open", quota: 4, experiencedShortlisted: 2, firstTimeShortlisted: 1, waiting: 1, notShortlisted: 2 }];
    if (path === `/admin/screening/${V}`) return VIEW;
    if (path === "/admin/applications/a1") return review;
    if (path === "/admin/interviewers") {
      return [
        { userId: "hr1", fullName: "Maria Santos", role: "hr" },
        { userId: "ad1", fullName: "Admin User", role: "admin" },
      ];
    }
    throw new Error(`unexpected ${path}`);
  });
  api.patch.mockResolvedValue({});
  api.post.mockResolvedValue({});
});

describe("Resume Screening list", () => {
  it("shows each vacancy with company and shortlist counts per group", async () => {
    renderAt("/admin/screening");
    const card = await screen.findByRole("link", { name: "Screen Cashier at Kabayan Mart" });
    expect(within(card).getByText("2 of 4")).toBeInTheDocument();
    expect(within(card).getByText("1 of 4")).toBeInTheDocument();
    expect(within(card).getByText("1 waiting · 2 not shortlisted")).toBeInTheDocument();
  });
});

describe("Vacancy shortlist (TC-37)", () => {
  it("has both group tabs with quota, locked marker, New upload to verify, waiting pool, and not-shortlisted reasons", async () => {
    renderAt(`/admin/screening/${V}`);
    expect(await screen.findByRole("tab", { name: "Applicants with Work Experience (2/4)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "First-Time Job Seekers (1/4)" })).toBeInTheDocument();
    expect(screen.getByText("Shortlist · 2 of 4")).toBeInTheDocument();

    const juan = screen.getByRole("link", { name: "Review Juan Dela Cruz" });
    expect(within(juan).getByLabelText("Locked: verification started")).toBeInTheDocument();
    expect(within(juan).getByText("Fully verified")).toBeInTheDocument();
    const ana = screen.getByRole("link", { name: "Review Ana Cruz" });
    expect(within(ana).getByText("New upload to verify")).toBeInTheDocument();

    expect(screen.getByText("Waiting pool · 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Ben Reyes" })).toBeInTheDocument();
    expect(screen.getByText(/Age must be between 18 and 35/)).toBeInTheDocument();
    expect(screen.getByText(/below the threshold 40/)).toBeInTheDocument();
  });
});

describe("Review sheet (FR-SCR-02..06)", () => {
  it("shows company and matching to HR, and the New upload to verify marker on the document (TC-99)", async () => {
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    expect(within(dialog).getByText("Cashier · Kabayan Mart")).toBeInTheDocument();
    expect(within(dialog).getByText(/Matched:/)).toBeInTheDocument();
    expect(within(dialog).getByText("New upload to verify")).toBeInTheDocument();
  });

  it("TC-38: Mark as verified sends the application id (slot lock)", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    const [resumeVerify] = within(dialog).getAllByRole("button", { name: "Mark as verified" });
    await user.click(resumeVerify);
    expect(api.patch).toHaveBeenCalledWith("/admin/resumes/r1/verification", { status: "verified", applicationId: "a1" });
  });

  it("Reject needs remarks and never drops", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    await user.click(within(dialog).getAllByRole("button", { name: "Reject" })[1]);
    const reject = await screen.findByRole("dialog", { name: "Reject NBI clearance?" });
    await user.click(within(reject).getByRole("button", { name: "Reject" }));
    expect(within(reject).getByText("Say why the document is rejected.")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(within(reject).getByLabelText("Remarks"), "Expired clearance");
    await user.click(within(reject).getByRole("button", { name: "Reject" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/documents/d1/verification", {
      status: "rejected",
      applicationId: "a1",
      remarks: "Expired clearance",
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("TC-39: Request new copy sends the type, target copy, and reason", async () => {
    const user = userEvent.setup();
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    await user.click(within(dialog).getByRole("button", { name: "Request new copy" }));
    const request = await screen.findByRole("dialog", { name: "Request a new copy of NBI clearance" });
    await user.type(within(request).getByLabelText("Reason (shown to the applicant)"), "The copy is blurred.");
    await user.click(within(request).getByRole("button", { name: "Send request" }));
    expect(api.post).toHaveBeenCalledWith("/admin/document-requests", {
      applicationId: "a1",
      documentType: "nbi_clearance",
      reason: "The copy is blurred.",
      targetDocumentId: "d1",
    });
  });

  it("TC-42: not fully verified → no next-step button, only the explanation", async () => {
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    expect(within(dialog).getByText(/Next step opens when the resume and every document are verified/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Schedule interview" })).not.toBeInTheDocument();
  });

  it("fully verified → Schedule interview (S13): Philippine time sent as +08:00, interviewer defaults to me, sheet closes", async () => {
    const user = userEvent.setup();
    review = sheet({ fullyVerified: true, nextStep: "schedule_interview" });
    api.post.mockResolvedValue({ interviewId: "i1", applicationStatus: "interview_scheduled" });
    const router = renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    const button = within(dialog).getByRole("button", { name: "Schedule interview" });
    expect(button).toBeEnabled();
    expect(within(dialog).queryByText("Available in S13")).not.toBeInTheDocument();
    await user.click(button);

    const form = await screen.findByRole("dialog", { name: "Schedule interview" });
    expect(within(form).getByLabelText("Interviewer")).toHaveValue("hr1"); // defaults to the signed-in HR user
    expect(within(form).getByLabelText("Duration")).toHaveValue("30");

    // Empty submit: every required field explains itself; nothing is sent.
    await user.click(within(form).getByRole("button", { name: "Schedule interview" }));
    expect(await within(form).findByText("Pick the interview date.")).toBeInTheDocument();
    expect(within(form).getByText("Pick the interview time.")).toBeInTheDocument();
    expect(within(form).getByText("Enter the meeting link (https://…).")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText("Date"), "2030-01-15");
    await user.type(within(form).getByLabelText("Time (Philippine time)"), "10:00");
    await user.type(within(form).getByLabelText("Meeting link"), "http://meet.google.com/abc");
    await user.click(within(form).getByRole("button", { name: "Schedule interview" }));
    expect(await within(form).findByText("Enter the meeting link (https://…).")).toBeInTheDocument(); // https only
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(form).getByLabelText("Meeting link"));
    await user.type(within(form).getByLabelText("Meeting link"), "https://meet.google.com/abc-defg-hij");
    await user.click(within(form).getByRole("button", { name: "Schedule interview" }));
    await vi.waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/interviews", {
        applicationId: "a1",
        scheduledAt: "2030-01-15T10:00:00+08:00",
        durationMinutes: 30,
        meetingLink: "https://meet.google.com/abc-defg-hij",
        interviewerId: "hr1",
      }),
    );
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/admin/screening/${V}`));
  });

  it("schedule: a past time is refused in the form; an API error (e.g. 422) is shown in the dialog", async () => {
    const user = userEvent.setup();
    review = sheet({ fullyVerified: true, nextStep: "schedule_interview" });
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    await user.click(within(dialog).getByRole("button", { name: "Schedule interview" }));
    const form = await screen.findByRole("dialog", { name: "Schedule interview" });

    await user.type(within(form).getByLabelText("Date"), "2020-01-15");
    await user.type(within(form).getByLabelText("Time (Philippine time)"), "10:00");
    await user.type(within(form).getByLabelText("Meeting link"), "https://meet.google.com/abc-defg-hij");
    await user.click(within(form).getByRole("button", { name: "Schedule interview" }));
    expect(await within(form).findByText("The interview time must be in the future.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    const { ApiError } = await import("@/lib/apiClient");
    api.post.mockRejectedValue(new ApiError(422, "BUSINESS_RULE", "Verify the resume and every document before scheduling the interview."));
    await user.clear(within(form).getByLabelText("Date"));
    await user.type(within(form).getByLabelText("Date"), "2030-01-15");
    await user.click(within(form).getByRole("button", { name: "Schedule interview" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Verify the resume and every document before scheduling the interview.");
  });

  it("once scheduled, the sheet points to Interviews Assessment instead of a next-step button", async () => {
    review = sheet({ application: { applicationId: "a1", status: "interview_scheduled", locked: false }, fullyVerified: true, nextStep: null });
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    expect(within(dialog).getByRole("link", { name: "Interviews Assessment" })).toHaveAttribute("href", "/admin/interviews");
    expect(within(dialog).queryByRole("button", { name: "Schedule interview" })).not.toBeInTheDocument();
  });

  it("ratings on file → Compute final score (reused ratings) rendered disabled with its S14 caption", async () => {
    review = sheet({
      fullyVerified: true,
      nextStep: "reuse_ratings",
      reusableEvaluation: { sourceApplicationId: "x", jobTitle: "Store Crew", companyName: "ClayGo", ratedAt: "2026-10-09T01:00:00Z" },
    });
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    expect(within(dialog).getByRole("button", { name: "Compute final score (reused ratings)" })).toBeDisabled();
    expect(
      within(dialog).getByText("Available after evaluation is built (S14). Applicants with ratings on file are not interviewed again."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Schedule interview" })).not.toBeInTheDocument(); // BR-21
    expect(within(dialog).getAllByText("Ratings on file").length).toBeGreaterThan(0);
  });

  it("Drop states the consequence with the company and sends the reason", async () => {
    const user = userEvent.setup();
    const router = renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    await user.click(within(dialog).getByRole("button", { name: "Drop application" }));
    const confirm = await screen.findByRole("dialog", { name: "Drop Juan Dela Cruz's application?" });
    expect(
      within(confirm).getByText(/This closes the application and the applicant can no longer apply to Kabayan Mart's jobs\./),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Drop application" }));
    expect(api.post).toHaveBeenCalledWith("/admin/applications/a1/drop", { reason: "failed_verification" });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/admin/screening/${V}`));
  });

  it("closed actions once the application left screening", async () => {
    review = sheet({ application: { applicationId: "a1", status: "dropped", locked: false } });
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    expect(within(dialog).getByText(/no longer in screening/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Mark as verified" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Drop application" })).not.toBeInTheDocument();
  });

  it("phone width: full-width sheet with small gutters, 480px drawer from sm; tab list scrolls inside itself", async () => {
    renderAt(`/admin/screening/${V}/a1`);
    const dialog = await openSheet();
    const classes = dialog.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["w-full", "sm:max-w-[480px]", "overflow-y-auto"]));
    expect(screen.getByRole("tablist", { hidden: true }).className).toContain("overflow-x-auto");
  });
});
