// First-time setup: upload → pre-filled card (TC-12) → confirm (TC-13).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

/** Runs `fn` with URL.createObjectURL / revokeObjectURL stubbed, then puts the originals back. */
async function withObjectUrls(fn) {
  const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  const stubs = { createObjectURL: vi.fn(() => "blob:photo-preview"), revokeObjectURL: vi.fn() };
  Object.assign(URL, stubs);
  try {
    await fn(stubs);
  } finally {
    Object.assign(URL, original);
  }
}

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

  it("decision 35: short texts, no '(optional)' on Contact number and Height, and white inputs", async () => {
    api.post.mockResolvedValueOnce(PARSED);
    const user = userEvent.setup();
    renderSetup();
    expect(screen.getByText("Upload your resume to get started.")).toBeInTheDocument();
    expect(screen.queryByText(/VERA fills in your profile/)).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
    expect(await screen.findByText("Check your profile and fill in any missing fields.")).toBeInTheDocument();
    expect(screen.queryByText(/Fields we could not find/)).not.toBeInTheDocument();
    expect(screen.queryByText("Juan_Resume.pdf")).not.toBeInTheDocument();

    // label change only: both stay optional (TC-13 confirms with a blank middle name; see the empty-fields test)
    expect(screen.getByLabelText("Contact number")).toHaveValue("0917-123-4567");
    expect(screen.getByLabelText("Height in cm")).toHaveValue(172.7);
    expect(screen.queryByText(/Contact number \(optional\)|Height in cm \(optional\)/)).not.toBeInTheDocument();

    // decision 39-1: editable fields white with the normal border, no autofill tint, no gray in OS dark mode
    for (const label of ["First name", "Contact number"]) {
      const field = screen.getByLabelText(label);
      expect(field).toBeEnabled();
      expect(field).toHaveClass("bg-card", "border-input", "autofill:shadow-[inset_0_0_0_1000px_var(--color-card)]");
      expect(field).not.toHaveClass("disabled:opacity-50", "dark:bg-input/30");
    }
    // decision 39-1 (amends 35-3): Age and Email are disabled, so light gray with readable text (not faded, not white)
    for (const label of ["Age", "Email"]) {
      const field = screen.getByLabelText(label);
      expect(field).toBeDisabled();
      expect(field).toHaveClass("border-input", "disabled:bg-surface-subtle", "disabled:text-muted-foreground");
      expect(field).not.toHaveClass("disabled:opacity-50", "disabled:opacity-100", "dark:bg-card", "dark:bg-input/30");
    }
  });

  it("decision 35: Upload photo previews the image in the avatar and sends nothing to the API", async () => {
    await withObjectUrls(async ({ createObjectURL, revokeObjectURL }) => {
      api.post.mockResolvedValueOnce(PARSED);
      const user = userEvent.setup();
      renderSetup();
      await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
      expect(await screen.findByText("JD")).toBeInTheDocument(); // initials of JUAN DELA CRUZ

      const picker = screen.getByLabelText("Choose a profile photo");
      expect(picker).toHaveAttribute("type", "file");
      expect(picker).toHaveAttribute("accept", "image/*");
      expect(screen.getByRole("button", { name: "Upload photo" })).toBeEnabled();
      expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();

      await user.upload(picker, new File([new Uint8Array(200)], "me.png", { type: "image/png" }));
      expect(screen.getByRole("img", { name: "Profile photo preview" })).toHaveAttribute("src", "blob:photo-preview");
      expect(screen.queryByText("JD")).not.toBeInTheDocument();
      expect(createObjectURL).toHaveBeenCalledOnce();

      // nothing uploaded or saved: the only calls are the resume parse and the /me read
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post.mock.calls[0][0]).toBe("/applicant/resume/parse");
      expect(api.get.mock.calls.length).toBeGreaterThan(0);
      expect(api.get.mock.calls.every(([path]) => path === "/me")).toBe(true);

      cleanup(); // unmount while stubbed: the preview URL is freed
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:photo-preview");
    });
  });

  it("decision 35: the photo picker refuses a file that is not an image", async () => {
    await withObjectUrls(async ({ createObjectURL }) => {
      api.post.mockResolvedValueOnce(PARSED);
      const user = userEvent.setup({ applyAccept: false }); // let the PDF reach the handler
      renderSetup();
      await user.upload(screen.getByLabelText("Choose a PDF file"), resumePdf());
      const picker = await screen.findByLabelText("Choose a profile photo");

      await user.upload(picker, resumePdf());
      expect(screen.getByText("Choose an image file.")).toBeInTheDocument();
      expect(picker).toHaveAttribute("aria-invalid", "true");
      expect(screen.queryByRole("img", { name: "Profile photo preview" })).not.toBeInTheDocument();
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledTimes(1);
    });
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
