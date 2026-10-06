import { afterEach, describe, expect, it, vi } from "vitest";

import { extractResume } from "../src/lib/svcClient.js";

const respond = (status, body) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe("svcClient.extractResume", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the PDF to svc /extract with the internal key", async () => {
    vi.stubGlobal("fetch", respond(200, { pageCount: 1 }));

    await expect(extractResume(Buffer.from("%PDF"), "resume.pdf")).resolves.toEqual({ pageCount: 1 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/extract");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Internal-Key"]).toBe("test-internal-key-0123456789abcdef");
    expect(init.body.get("file").name).toBe("resume.pdf");
  });

  it("turns a svc 400 into a validation error with the svc's message", async () => {
    vi.stubGlobal("fetch", respond(400, { detail: "This PDF has no selectable text." }));
    await expect(extractResume(Buffer.from("%PDF"), "r.pdf")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "This PDF has no selectable text.",
    });
  });

  it.each([
    ["unreachable", vi.fn().mockRejectedValue(new TypeError("fetch failed"))],
    ["failing", respond(500, { detail: "boom" })],
    ["rejecting the key", respond(401, { detail: "invalid internal key" })],
  ])("returns SVC_UNAVAILABLE when the svc is %s", async (_label, fetchMock) => {
    vi.stubGlobal("fetch", fetchMock);
    await expect(extractResume(Buffer.from("%PDF"), "r.pdf")).rejects.toMatchObject({ status: 503, code: "SVC_UNAVAILABLE" });
  });
});
