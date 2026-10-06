import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: vi.fn(), signOut: vi.fn() } },
}));

const { supabase } = await import("./supabase");
const { api, ApiError } = await import("./apiClient");

const respond = (status, body) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the Supabase access token and unwraps { data }", async () => {
    vi.stubGlobal("fetch", respond(200, { data: { role: "hr" } }));

    await expect(api.get("/me")).resolves.toEqual({ role: "hr" });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/me",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer tok-123" } }),
    );
  });

  it("sends JSON bodies", async () => {
    vi.stubGlobal("fetch", respond(201, { data: { id: 1 } }));
    await api.post("/things", { name: "Cashier" });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ name: "Cashier" }));
  });

  it("throws ApiError with the API's code, message, and details", async () => {
    vi.stubGlobal(
      "fetch",
      respond(400, { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", details: [{ path: "name" }] } }),
    );

    const error = await api.post("/things", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR", message: "Some fields are invalid" });
    expect(error.details).toEqual([{ path: "name" }]);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("signs out on 401 so the guards return the user to /login", async () => {
    vi.stubGlobal("fetch", respond(401, { error: { code: "UNAUTHENTICATED", message: "Your session has expired." } }));
    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it("turns a network failure into a readable ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.get("/me")).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });
});
