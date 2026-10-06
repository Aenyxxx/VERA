// Email confirmation landing (/auth/callback): PKCE ?code=, implicit #access_token, and the fallback.
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { session: null, loading: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { exchangeCodeForSession: vi.fn() } } }));

const { supabase } = await import("@/lib/supabase");
const { default: AuthCallback } = await import("./AuthCallback");

function renderAt(url) {
  window.history.replaceState(null, "", url); // the page reads window.location like supabase-js does
  const router = createMemoryRouter(
    [
      { path: "/auth/callback", element: <AuthCallback /> },
      { path: "/", element: <p>Home</p> },
    ],
    { initialEntries: ["/auth/callback"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.session = null;
    auth.loading = false;
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("continues home once supabase-js has read the session from the link (#access_token)", async () => {
    auth.session = { user: { id: "u1" } };
    const router = renderAt("/auth/callback#access_token=abc&type=signup");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE ?code= for a session", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    renderAt("/auth/callback?code=xyz");
    await waitFor(() => expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz"));
  });

  it("asks the user to log in when the code cannot be exchanged (other browser or device)", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error("code verifier not found") });
    renderAt("/auth/callback?code=xyz");

    expect(await screen.findByRole("heading", { name: "Your email is confirmed. Please log in." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login");
  });

  it("asks the user to log in when the link carries an error (expired or used)", async () => {
    renderAt("/auth/callback#error=access_denied&error_code=otp_expired");
    expect(await screen.findByRole("heading", { name: "Your email is confirmed. Please log in." })).toBeInTheDocument();
  });
});
