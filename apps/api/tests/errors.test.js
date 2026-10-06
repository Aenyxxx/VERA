import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));

const { app } = await import("../src/app.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");
const { validate } = await import("../src/middleware/validate.js");
const { conflict } = await import("../src/lib/errors.js");

function miniApp(...handlers) {
  const mini = express();
  mini.use(express.json());
  mini.post("/test", ...handlers);
  mini.use(errorHandler);
  return mini;
}

describe("error format", () => {
  it("unknown route → 404 NOT_FOUND", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Route GET /api/nope not found" } });
  });

  it("malformed JSON → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/me").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("AppError keeps its status, code, and details", async () => {
    const res = await request(
      miniApp(() => {
        throw conflict("Already applied", { vacancyId: "v1" });
      }),
    ).post("/test");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "CONFLICT", message: "Already applied", details: { vacancyId: "v1" } } });
  });

  it("unexpected error → 500 INTERNAL without internals", async () => {
    const res = await request(
      miniApp(async () => {
        throw new Error("secret internals");
      }),
    ).post("/test");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
  });
});

describe("validate", () => {
  const schema = { body: z.object({ name: z.string().min(1), slots: z.coerce.number().int().positive() }) };
  const echo = (req, res) => res.json({ data: req.body });

  it("returns field details for invalid input", async () => {
    const res = await request(miniApp(validate(schema), echo)).post("/test").send({ name: "", slots: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(["name", "slots"]);
  });

  it("replaces req.body with the parsed value", async () => {
    const res = await request(miniApp(validate(schema), echo)).post("/test").send({ name: "Cashier", slots: "2" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Cashier", slots: 2 });
  });
});
