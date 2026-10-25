// Decision 39-5: Log out asks first, from the sidebar, the phone drawer and the top-bar account menu (every role).
// Clicking Log out only opens "Log out?"; Cancel or Escape keeps the session; "Log out" signs out (same signOut as
// before) and shows the loading state while it runs.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn() },
}));
const auth = { session: { user: { id: "u1" } }, loading: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { api } = await import("@/lib/apiClient");
const { Sidebar } = await import("./Sidebar");
const { Header } = await import("./Header");
const { AppShell } = await import("./AppShell");

function renderUi(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

async function expectConfirmDialog() {
  const dialog = await screen.findByRole("dialog", { name: "Log out?" });
  expect(within(dialog).getByText("You will need to sign in again to use VERA.")).toBeInTheDocument();
  // the footer's Cancel and Log out, plus the shared dialog's standard close icon
  expect(within(dialog).getAllByRole("button").map((b) => b.textContent)).toEqual(["Cancel", "Log out", "Close"]);
  // Log out is the primary button (not the red destructive one)
  expect(within(dialog).getByRole("button", { name: "Log out" })).not.toHaveClass("bg-destructive");
  return dialog;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.signOut.mockResolvedValue(undefined);
  api.get.mockResolvedValue({ userId: "u1", email: "ana@vera.test", role: "hr", fullName: "Ana Cruz" });
  api.list.mockResolvedValue({ data: [], meta: { unreadCount: 0 } });
});

describe("decision 39-5: Log out confirmation — sidebar", () => {
  it("Log out opens the dialog and does not sign out; Cancel closes it and keeps the session", async () => {
    const user = userEvent.setup();
    renderUi(<Sidebar items={[]} />);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = await expectConfirmDialog();
    expect(auth.signOut).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument());
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("Escape closes the dialog and keeps the session", async () => {
    const user = userEvent.setup();
    renderUi(<Sidebar items={[]} />);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await expectConfirmDialog();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument());
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("confirming signs out once, with the loading state while it runs", async () => {
    const user = userEvent.setup();
    let finish;
    auth.signOut.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderUi(<Sidebar items={[]} />);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = await expectConfirmDialog();
    await user.click(within(dialog).getByRole("button", { name: "Log out" }));
    expect(auth.signOut).toHaveBeenCalledOnce();
    // pending: both buttons disabled, the dialog stays open (Escape does not close it)
    expect(within(dialog).getByRole("button", { name: "Log out" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Log out?" })).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument());
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});

describe("decision 39-5: Log out confirmation — top-bar account menu", () => {
  it("the menu's Log out opens the dialog without signing out; Cancel keeps the session; confirming signs out", async () => {
    const user = userEvent.setup();
    renderUi(<Header items={[]} />);
    await screen.findByText("Ana Cruz");
    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));
    let dialog = await expectConfirmDialog();
    expect(auth.signOut).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument());
    expect(auth.signOut).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));
    dialog = await expectConfirmDialog();
    await user.click(within(dialog).getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  });
});

describe("decision 39-5: Log out confirmation — phone drawer", () => {
  it("Log out in the drawer opens the dialog; Cancel keeps the session; confirming signs out", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: "/", element: <AppShell items={[]} />, children: [{ index: true, element: <p>Home</p> }] }]);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    await user.click(within(drawer).getByRole("button", { name: "Log out" }));
    let dialog = await expectConfirmDialog();
    expect(auth.signOut).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument());
    expect(auth.signOut).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("button", { name: "Log out" }));
    dialog = await expectConfirmDialog();
    await user.click(within(dialog).getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  });
});
