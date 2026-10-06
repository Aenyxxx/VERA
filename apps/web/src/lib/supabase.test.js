// Remember me (FR-AUTH-03, logic behind TC-05).
import { describe, expect, it } from "vitest";

import { rememberMeStorage, setRememberMe } from "./supabase";

describe("remember-me session storage", () => {
  it("keeps the session in localStorage when Remember me is checked (survives a browser restart)", () => {
    setRememberMe(true);
    rememberMeStorage.setItem("sb-session", "token");
    expect(localStorage.getItem("sb-session")).toBe("token");
    expect(sessionStorage.getItem("sb-session")).toBeNull();
    expect(rememberMeStorage.getItem("sb-session")).toBe("token");
  });

  it("keeps the session in sessionStorage when unchecked (ends when the browser closes)", () => {
    setRememberMe(false);
    rememberMeStorage.setItem("sb-session", "token");
    expect(sessionStorage.getItem("sb-session")).toBe("token");
    expect(localStorage.getItem("sb-session")).toBeNull();
  });

  it("removes the session from both stores on sign-out", () => {
    localStorage.setItem("sb-session", "a");
    sessionStorage.setItem("sb-session", "b");
    rememberMeStorage.removeItem("sb-session");
    expect(localStorage.getItem("sb-session")).toBeNull();
    expect(sessionStorage.getItem("sb-session")).toBeNull();
  });
});
