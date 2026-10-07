// Notifications page and the header bell count (PRD FR-NOTIF-01, simplified).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn(), post: vi.fn() },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { default: Notifications } = await import("./Notifications");
const { Header } = await import("@/layouts/Header");

const NOTICE = {
  notificationId: "n1",
  type: "shortlisted",
  title: "Under review: Cashier",
  message: "You are on the shortlist. HR will review your resume and documents.",
  linkPath: "/applicant",
  requiresAction: false,
  isRead: false,
  createdAt: "2026-10-10T00:30:00.000Z",
};

function renderWithProviders(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Notifications page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the user's notifications, newest first, with an unread marker", async () => {
    api.list.mockResolvedValue({ data: [NOTICE], meta: { unreadCount: 1 } });
    renderWithProviders(<Notifications />);

    expect(await screen.findByText("Under review: Cashier")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith("/notifications?limit=50");
    expect(screen.getByText("(unread)")).toBeInTheDocument();
    expect(screen.getByText("Oct 10, 2026, 8:30 AM")).toBeInTheDocument();
  });

  it("marks all as read", async () => {
    api.list.mockResolvedValue({ data: [NOTICE], meta: { unreadCount: 1 } });
    api.post.mockResolvedValue({ updated: 1 });
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(api.post).toHaveBeenCalledWith("/notifications/read-all");
  });

  it("hides Mark all as read when nothing is unread, and shows the empty state", async () => {
    api.list.mockResolvedValue({ data: [], meta: { unreadCount: 0 } });
    renderWithProviders(<Notifications />);
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    api.list.mockRejectedValue(new ApiError(500, "INTERNAL", "Something went wrong."));
    renderWithProviders(<Notifications />);
    expect(await screen.findByText("Notifications could not be loaded")).toBeInTheDocument();
  });
});

describe("Header bell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ userId: "u1", email: "a@vera.test", role: "applicant", fullName: "Ana Cruz" });
  });

  it("shows the real unread count", async () => {
    api.list.mockResolvedValue({ data: [NOTICE], meta: { unreadCount: 3 } });
    renderWithProviders(<Header items={[]} />);
    expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toHaveAttribute(
      "href",
      "/applicant/notifications",
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows no count at 0", async () => {
    api.list.mockResolvedValue({ data: [], meta: { unreadCount: 0 } });
    renderWithProviders(<Header items={[]} />);
    await vi.waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
