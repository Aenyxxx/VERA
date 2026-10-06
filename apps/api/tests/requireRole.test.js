// Role enforcement (FR-AUTH-08; mechanism behind TC-10).
import { ROLES } from "@vera/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../src/middleware/errorHandler.js";
import { requireRole } from "../src/middleware/requireRole.js";

function appAs(role) {
  const app = express();
  app.use((req, res, next) => {
    req.auth = role ? { userId: "u1", role } : undefined;
    next();
  });
  app.get("/admin-only", requireRole(ROLES.ADMIN, ROLES.HR), (req, res) => res.json({ data: "ok" }));
  app.use(errorHandler);
  return app;
}

describe("requireRole", () => {
  it("blocks an applicant from an admin/HR route with 403 FORBIDDEN (TC-10)", async () => {
    const res = await request(appAs(ROLES.APPLICANT)).get("/admin-only");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it.each([ROLES.ADMIN, ROLES.HR])("allows %s", async (role) => {
    const res = await request(appAs(role)).get("/admin-only");
    expect(res.status).toBe(200);
  });

  it("blocks a request that was not authenticated", async () => {
    const res = await request(appAs(null)).get("/admin-only");
    expect(res.status).toBe(403);
  });
});
