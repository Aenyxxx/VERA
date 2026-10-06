// Applicant sign-up (FR-AUTH-02, FR-AUTH-06 simplified; TC-03).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signUp: vi.fn() } } }));

const { supabase } = await import("@/lib/supabase");
const { SignUpForm } = await import("./SignUpForm");

function setup() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SignUpForm />
    </MemoryRouter>,
  );
  return user;
}

async function fill(user, { email = "ana@example.com", password = "Secret123", confirm = password, consent = true } = {}) {
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  if (consent) await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignUpForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a password without the required length, letter, and number (TC-03)", async () => {
    const user = setup();
    await fill(user, { password: "abc123" });
    expect(await screen.findByText("At least 8 characters with a letter and a number")).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it.each(["abcdefgh", "12345678"])("rejects %s (needs a letter and a number)", async (password) => {
    const user = setup();
    await fill(user, { password });
    expect(await screen.findByText("At least 8 characters with a letter and a number")).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation (TC-03)", async () => {
    const user = setup();
    await fill(user, { confirm: "Secret124" });
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("requires the Data Privacy Act consent", async () => {
    const user = setup();
    await fill(user, { consent: false });
    expect(await screen.findByText("You must agree before creating an account")).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("signs up with the callback link and consent timestamp, then asks the user to check their email", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    const user = setup();

    await fill(user, { email: " ana@example.com " });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "Secret123",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { privacy_consent_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      },
    });
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("shows a readable message when Supabase refuses", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: { status: 429, message: "email rate limit exceeded" } });
    const user = setup();
    await fill(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many sign-up attempts");
  });
});
