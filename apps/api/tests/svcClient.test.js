import { afterEach, describe, expect, it, vi } from "vitest";

import { extractResume, matchResume } from "../src/lib/svcClient.js";

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

describe("svcClient.matchResume", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the stored sections, job, and weights as JSON to svc /match with the internal key", async () => {
    vi.stubGlobal("fetch", respond(200, { matchScore: 79.31 }));
    const input = {
      sections: { skills: "Cash handling", experience: "Cashier" },
      job: { skills: "Cash handling", experience: "Cashier", minYears: 1 },
      weights: { skills: 0.5, experience: 0.5 },
    };

    await expect(matchResume(input)).resolves.toEqual({ matchScore: 79.31 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/match");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", "X-Internal-Key": "test-internal-key-0123456789abcdef" });
    expect(JSON.parse(init.body)).toEqual({ resume: { sections: input.sections }, job: input.job, weights: input.weights });
  });

  it("returns SVC_UNAVAILABLE when the svc rejects the body", async () => {
    vi.stubGlobal("fetch", respond(422, { detail: [] }));
    await expect(matchResume({ sections: {}, job: {}, weights: {} })).rejects.toMatchObject({ status: 503 });
  });
});
