// User Management (decision 19, Phase 4; TC-08/09, TC-110): admin-only nav item and route, staff table, Add HR
// account (validation, body, API error), Deactivate / Activate with a confirm, no action on your own row.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/useMe", () => ({ useMe: vi.fn() }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { useMe } = await import("@/hooks/useMe");
const { RequireRole } = await import("@/routes/RequireRole");
const { ADMIN_NAV, navFor } = await import("@/layouts/navigation");
const { default: Users } = await import("./Users");

const ME = { userId: "u-admin", role: "admin", email: "admin@vera.test", fullName: "VERA Admin", hasProfile: false };
const ROWS = [
  { userId: "u-admin", email: "admin@vera.test", fullName: "VERA Admin", role: "admin", accountStatus: "active", lastSignInAt: "2030-10-18T00:30:00.000Z", isSelf: true },
  { userId: "u-hr", email: "hr@vera.test", fullName: "Rosa Dela Cruz", role: "hr", accountStatus: "active", lastSignInAt: null, isSelf: false },
  { userId: "u-old", email: "old@vera.test", fullName: "Ben Old", role: "hr", accountStatus: "inactive", lastSignInAt: null, isSelf: false },
];

function renderAt(path = "/admin/users") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin", element: <p>HR home</p> },
      { element: <RequireRole roles={["admin"]} />, children: [{ path: "/admin/users", element: <Users /> }] },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// The table shows skeleton rows while loading: wait for the data before picking a row.
async function rowsLoaded() {
  await screen.findByText("Rosa Dela Cruz");
  return screen.getAllByRole("row");
}

beforeEach(() => {
  vi.clearAllMocks();
  useMe.mockReturnValue({ data: ME });
  api.get.mockResolvedValue(ROWS);
});

describe("admin only", () => {
  it("the nav item is shown to admin and never to HR", () => {
    expect(navFor(ADMIN_NAV, "admin").map((i) => i.label)).toContain("User Management");
    const hrNav = navFor(ADMIN_NAV, "hr").map((i) => i.label);
    expect(hrNav).toContain("Applicant Pool");
    expect(hrNav).not.toContain("User Management");
    expect(hrNav).toHaveLength(ADMIN_NAV.length - 1);
  });

  it("HR opening /admin/users is sent home and nothing is loaded", async () => {
    useMe.mockReturnValue({ data: { ...ME, role: "hr" } });
    renderAt();
    expect(await screen.findByText("HR home")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("staff table", () => {
  it("lists staff with role, status, last sign-in; your own row has Edit only (no Deactivate)", async () => {
    renderAt();
    expect(await screen.findByText("Rosa Dela Cruz")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/admin/users");
    const [, admin, hr, old] = screen.getAllByRole("row");
    expect(within(admin).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "VERA Admin(you)admin@vera.test", "Admin", "Active", "Oct 18, 2030, 8:30 AM", "Edit",
    ]);
    expect(within(admin).getAllByRole("button").map((b) => b.textContent)).toEqual(["Edit"]);
    expect(within(hr).getAllByRole("button").map((b) => b.textContent)).toEqual(["Edit", "Deactivate"]);
    expect(within(hr).getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(within(hr).getAllByRole("cell")[3]).toHaveTextContent("Never");
    expect(within(old).getAllByRole("cell")[2]).toHaveTextContent("Inactive");
    expect(within(old).getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("shows an error state with Try again", async () => {
    api.get.mockRejectedValue(new ApiError(500, "INTERNAL", "boom"));
    renderAt();
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("Add HR account", () => {
  it("validates, then posts email, name, and one password (the confirm field is never sent)", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ userId: "u-new", email: "new@vera.test", fullName: "New HR", role: "hr", accountStatus: "active" });
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Add HR account" }));
    const dialog = await screen.findByRole("dialog", { name: "Add HR account" });
    expect(within(dialog).queryByLabelText("Temporary password")).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Password"), "abcdefgh");
    await user.click(within(dialog).getByRole("button", { name: "Create HR account" }));
    expect(await within(dialog).findByText("Enter the email address")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the full name")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/At least 8 characters with a letter and a number/)).toHaveLength(2); // hint + error
    expect(within(dialog).getByText("Confirm the password")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Email"), "new@vera.test");
    await user.type(within(dialog).getByLabelText("Full name"), "New HR");
    await user.clear(within(dialog).getByLabelText("Password"));
    await user.type(within(dialog).getByLabelText("Password"), "Temp1234");
    await user.type(within(dialog).getByLabelText("Confirm password"), "Temp1234");
    await user.click(within(dialog).getByRole("button", { name: "Create HR account" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/users", { email: "new@vera.test", fullName: "New HR", temporaryPassword: "Temp1234" }),
    );
    expect(toast.success).toHaveBeenCalledWith("HR account created for New HR");
  });

  it("a confirm password that does not match → error in the dialog, nothing posted", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Add HR account" }));
    const dialog = await screen.findByRole("dialog", { name: "Add HR account" });
    await user.type(within(dialog).getByLabelText("Email"), "new@vera.test");
    await user.type(within(dialog).getByLabelText("Full name"), "New HR");
    await user.type(within(dialog).getByLabelText("Password"), "Temp1234");
    await user.type(within(dialog).getByLabelText("Confirm password"), "Temp12345");
    await user.click(within(dialog).getByRole("button", { name: "Create HR account" }));
    expect(await within(dialog).findByText("Passwords do not match")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("a 409 (email taken) is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, "CONFLICT", "An account with this email already exists."));
    renderAt();
    await user.click(await screen.findByRole("button", { name: "Add HR account" }));
    const dialog = await screen.findByRole("dialog", { name: "Add HR account" });
    await user.type(within(dialog).getByLabelText("Email"), "hr@vera.test");
    await user.type(within(dialog).getByLabelText("Full name"), "Dup");
    await user.type(within(dialog).getByLabelText("Password"), "Temp1234");
    await user.type(within(dialog).getByLabelText("Confirm password"), "Temp1234");
    await user.click(within(dialog).getByRole("button", { name: "Create HR account" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Edit (full name / password, Oct 19 change 1b)", () => {
  async function openEdit(user, rowIndex, title) {
    renderAt();
    await user.click(within((await rowsLoaded())[rowIndex]).getByRole("button", { name: "Edit" }));
    return screen.findByRole("dialog", { name: title });
  }

  it("prefills the name, shows the email as text only, and sends only a changed name", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ ...ROWS[1], fullName: "Rosa M. Dela Cruz", passwordChanged: false });
    const dialog = await openEdit(user, 2, "Edit Rosa Dela Cruz");
    expect(within(dialog).getByLabelText("Full name")).toHaveValue("Rosa Dela Cruz");
    expect(within(dialog).getByText(/Email: hr@vera\.test \(cannot be changed\)/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Email")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("textbox").map((t) => t.id)).toEqual(["fullName"]); // the only text input

    await user.clear(within(dialog).getByLabelText("Full name"));
    await user.type(within(dialog).getByLabelText("Full name"), "Rosa M. Dela Cruz");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/u-hr", { fullName: "Rosa M. Dela Cruz" }));
    expect(toast.success).toHaveBeenCalledWith("Saved the changes for Rosa M. Dela Cruz");
  });

  it("a new password with a matching confirm sends only the password (your own row too)", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ ...ROWS[0], passwordChanged: true });
    const dialog = await openEdit(user, 1, "Edit VERA Admin");
    await user.type(within(dialog).getByLabelText("New password"), "NewPass123");
    await user.type(within(dialog).getByLabelText("Confirm new password"), "NewPass123");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/u-admin", { password: "NewPass123" }));
  });

  it("a mismatched confirm, a weak password, or no change → message, nothing sent", async () => {
    const user = userEvent.setup();
    const dialog = await openEdit(user, 2, "Edit Rosa Dela Cruz");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByText("Nothing to change.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("New password"), "NewPass123");
    await user.type(within(dialog).getByLabelText("Confirm new password"), "NewPass124");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByText("Passwords do not match")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("New password"));
    await user.type(within(dialog).getByLabelText("New password"), "abcdefgh");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findAllByText(/At least 8 characters with a letter and a number/)).toHaveLength(2); // hint + error
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("an API error is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue(new ApiError(502, "AUTH_PROVIDER", "Could not update the account. Try again."));
    const dialog = await openEdit(user, 3, "Edit Ben Old");
    await user.type(within(dialog).getByLabelText("New password"), "NewPass123");
    await user.type(within(dialog).getByLabelText("Confirm new password"), "NewPass123");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not update the account. Try again.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Deactivate / Activate", () => {
  it("deactivate confirms with the consequence, then patches", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ userId: "u-hr", accountStatus: "inactive", signInBlocked: true });
    renderAt();
    await user.click(within((await rowsLoaded())[2]).getByRole("button", { name: "Deactivate" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate Rosa Dela Cruz?" });
    expect(within(dialog).getByText("Rosa Dela Cruz can no longer sign in. Their past work stays in VERA.")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/u-hr/status", { accountStatus: "inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Rosa Dela Cruz can no longer sign in");
  });

  it("a failed Supabase ban warns to press Deactivate again", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ userId: "u-hr", accountStatus: "inactive", signInBlocked: false });
    renderAt();
    await user.click(within((await rowsLoaded())[2]).getByRole("button", { name: "Deactivate" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Rosa Dela Cruz is deactivated in VERA, but the sign-in block failed. Press Deactivate again."),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("activate patches active; a 409 is shown in the dialog", async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Keep at least one active admin."));
    renderAt();
    await user.click(within((await rowsLoaded())[3]).getByRole("button", { name: "Activate" }));
    const dialog = await screen.findByRole("dialog", { name: "Activate Ben Old?" });
    await user.click(within(dialog).getByRole("button", { name: "Activate" }));
    expect(api.patch).toHaveBeenCalledWith("/admin/users/u-old/status", { accountStatus: "active" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Keep at least one active admin.");
  });
});
