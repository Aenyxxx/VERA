// Login form (FR-AUTH-02, FR-AUTH-03).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
  setRememberMe: vi.fn(),
}));

const { supabase, setRememberMe } = await import("@/lib/supabase");
const { LoginForm } = await import("./LoginForm");

async function fillAndSubmit(user, { email = "hr@vera.test", password = "Secret123" } = {}) {
  if (email) await user.type(screen.getByLabelText("Email address"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows field errors and does not call Supabase when empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user, { email: "not-an-email" });
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with the trimmed email and stores the Remember me choice", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("checkbox"));
    await fillAndSubmit(user, { email: "  hr@vera.test " });

    expect(setRememberMe).toHaveBeenCalledWith(true);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "hr@vera.test", password: "Secret123" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("defaults Remember me to off", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);
    expect(setRememberMe).toHaveBeenCalledWith(false);
  });

  it("shows a form message for wrong credentials and keeps the email", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByLabelText("Email address")).toHaveValue("hr@vera.test");
  });

  it("explains an unconfirmed email", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", message: "Email not confirmed", status: 400 },
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirm your email first");
  });

  it("toggles password visibility with a labeled button", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
