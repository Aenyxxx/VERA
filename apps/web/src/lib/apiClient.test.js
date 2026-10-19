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

  it("download returns the file and its name from Content-Disposition, with the token (endorsement packet)", async () => {
    const blob = new Blob(["%PDF-"], { type: "application/pdf" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Disposition": 'attachment; filename="Cruz_Ana_Cashier_Endorsement.pdf"' }),
        blob: async () => blob,
      }),
    );
    await expect(api.download("/admin/applications/a1/packet")).resolves.toEqual({ blob, filename: "Cruz_Ana_Cashier_Endorsement.pdf" });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/admin/applications/a1/packet",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer tok-123" } }),
    );
  });

  it("download errors are ApiErrors like every other call", async () => {
    vi.stubGlobal("fetch", respond(409, { error: { code: "CONFLICT", message: "The resume file could not be added." } }));
    await expect(api.download("/admin/applications/a1/packet")).rejects.toMatchObject({
      status: 409,
      message: "The resume file could not be added.",
    });
  });
});
