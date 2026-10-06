// Route guards: sign-in, role, and profile redirects (FR-AUTH-01, FR-AUTH-08; logic behind TC-04).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { session: null, loading: false, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn() },
}));

const { api, ApiError } = await import("@/lib/apiClient");
const { routes } = await import("@/app/routes");

function renderAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const signedInAs = (me) => {
  auth.session = { user: { id: "u1" }, access_token: "t" };
  api.get.mockResolvedValue({ userId: "u1", email: "user@vera.test", fullName: null, accountStatus: "active", ...me });
};

describe("route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.session = null;
  });

  it("sends a signed-out visitor to /login", async () => {
    const router = renderAt("/admin/companies");
    expect(await screen.findByRole("heading", { name: "Welcome to VERA" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("sends HR from / to the admin dashboard", async () => {
    signedInAs({ role: "hr", hasProfile: false });
    const router = renderAt("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
  });

  it("sends an applicant away from admin pages", async () => {
    signedInAs({ role: "applicant", hasProfile: true });
    const router = renderAt("/admin");
    await waitFor(() => expect(router.state.location.pathname).toBe("/applicant"));
  });

  it("sends HR away from applicant pages", async () => {
    signedInAs({ role: "hr", hasProfile: false });
    const router = renderAt("/applicant/jobs");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
  });

  it("sends an applicant without a profile to setup", async () => {
    signedInAs({ role: "applicant", hasProfile: false });
    const router = renderAt("/applicant/jobs");
    await waitFor(() => expect(router.state.location.pathname).toBe("/applicant/setup"));
  });

  it("sends an applicant with a profile away from setup", async () => {
    signedInAs({ role: "applicant", hasProfile: true });
    const router = renderAt("/applicant/setup");
    await waitFor(() => expect(router.state.location.pathname).toBe("/applicant"));
  });

  it("sends a signed-in user away from /login", async () => {
    signedInAs({ role: "admin", hasProfile: false });
    const router = renderAt("/login");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
  });

  it("signs out a deactivated account (403)", async () => {
    auth.session = { user: { id: "u1" }, access_token: "t" };
    api.get.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your account is deactivated. Contact the agency."));
    renderAt("/admin");
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  });

  it("shows the staff navigation inside the admin shell", async () => {
    signedInAs({ role: "hr", hasProfile: false, fullName: "Hannah Reyes" });
    renderAt("/admin/companies");
    expect(await screen.findByRole("heading", { name: "Company Management" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Resume Screening/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Hannah Reyes")).toBeInTheDocument();
  });
});
