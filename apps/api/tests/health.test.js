import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { pool } = await import("../src/db/pool.js");
const { app } = await import("../src/app.js");

describe("GET /api/health", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is public and reports ok when db and svc are up", async () => {
    pool.query.mockResolvedValue({ rows: [{}] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok", db: "up", svc: "up" } });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/health", expect.any(Object));
  });

  it("is degraded (200) when the svc is down", async () => {
    pool.query.mockResolvedValue({ rows: [{}] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "degraded", db: "up", svc: "down" });
  });

  it("returns 503 when the database is down", async () => {
    pool.query.mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.data).toEqual({ status: "down", db: "down", svc: "up" });
  });
});
