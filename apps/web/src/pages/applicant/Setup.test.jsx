// First-time setup: upload → pre-filled card (TC-12) → confirm (TC-13).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { session: { user: { id: "u1" } }, loading: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { default: Setup } = await import("./Setup");

const PARSED = {
  profile: {
    firstName: "JUAN",
    middleName: "",
    lastName: "DELA CRUZ",
    suffix: "",
    email: "juan@vera.test",
    contactNumber: "0917-123-4567",
    birthdate: "2000-01-15",
    gender: "male",
    heightCm: 172.7,
    addressLine: "Blk 5 Lot 3, Brgy. San Jose",
    city: "Baliuag",
    province: "Bulacan",
    educationLevel: "senior_high",
  },
  warnings: ["no dates found in experience (years counted as 0)"],
  fileName: "Juan_Resume.pdf",
  yearsExperience: 0,
};

function renderSetup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/applicant/setup", element: <Setup /> },
      { path: "/applicant", element: <p>Dashboard</p> },
    ],
    { initialEntries: ["/applicant/setup"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

const resumePdf = () => new File([new Uint8Array(500)], "Juan_Resume.pdf", { type: "application/pdf" });

describe("Setup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ userId: "u1", email: "juan@vera.test", role: "applicant", hasProfile: false });
  });

  it("uploads the resume and shows the pre-filled profile with the computed age (TC-12)", async () => {
    api.post.mockResolvedValueOnce(PARSED);
    const user = userEvent.setup();
    renderSetup();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());

    expect(await screen.findByLabelText("First name")).toHaveValue("JUAN");
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/applicant/resume/parse");
    expect(body.get("resume").name).toBe("Juan_Resume.pdf");

    expect(screen.getByLabelText("Last name")).toHaveValue("DELA CRUZ");
    expect(screen.getByLabelText("Birthday")).toHaveValue("2000-01-15");
    expect(Number(screen.getByLabelText("Age").value)).toBeGreaterThanOrEqual(26);
    expect(screen.getByLabelText("Highest education level")).toHaveValue("senior_high");
    expect(screen.getByLabelText("Email")).toHaveValue("juan@vera.test");
    expect(screen.getByText(/no dates found in experience/)).toBeInTheDocument();
  });

  it("shows the API's message when the resume cannot be read (TC-11)", async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_ERROR", "This PDF has no selectable text. Upload a text-based PDF (not a scanned image)."),
    );
    const user = userEvent.setup();
    renderSetup();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());

    expect(await screen.findByRole("alert")).toHaveTextContent("no selectable text");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("confirms the edited profile and continues to the dashboard (TC-13)", async () => {
    api.post.mockResolvedValueOnce(PARSED).mockResolvedValueOnce({ applicantId: "a1" });
    const user = userEvent.setup();
    const { router } = renderSetup();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
    const firstName = await screen.findByLabelText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Juan");
    await user.clear(screen.getByLabelText("Last name"));
    await user.type(screen.getByLabelText("Last name"), "Dela Cruz");
    await user.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/applicant"));
    expect(api.post).toHaveBeenLastCalledWith("/applicant/profile/confirm", {
      firstName: "Juan",
      middleName: null,
      lastName: "Dela Cruz",
      suffix: null,
      contactNumber: "0917-123-4567",
      birthdate: "2000-01-15",
      gender: "male",
      heightCm: 172.7,
      addressLine: "Blk 5 Lot 3, Brgy. San Jose",
      city: "Baliuag",
      province: "Bulacan",
      educationLevel: "senior_high",
    });
  });

  it("keeps the applicant on the card with field errors when required fields are empty", async () => {
    api.post.mockResolvedValueOnce({ ...PARSED, profile: { ...PARSED.profile, province: "", educationLevel: "" } });
    const user = userEvent.setup();
    renderSetup();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
    await user.click(await screen.findByRole("button", { name: "Confirm profile" }));

    expect(await screen.findByText("Enter your province")).toBeInTheDocument();
    expect(screen.getByText("Select your highest education level")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1); // only the parse
  });

  it("lets the applicant upload a different resume", async () => {
    api.post.mockResolvedValueOnce(PARSED);
    const user = userEvent.setup();
    renderSetup();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
    await user.click(await screen.findByRole("button", { name: "Upload a different resume" }));
    expect(screen.getByText("Upload your resume")).toBeInTheDocument();
  });
});
