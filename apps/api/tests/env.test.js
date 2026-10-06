import { describe, expect, it } from "vitest";

import { parseEnv } from "../src/config/env.js";

const valid = {
  DATABASE_URL: "postgresql://u:p@host:5432/db",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SECRET_KEY: "secret",
  SVC_INTERNAL_KEY: "k".repeat(32),
};

describe("parseEnv", () => {
  it("applies defaults and converts types", () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(5000);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.WEB_ORIGIN).toBe("http://localhost:5173");
    expect(parseEnv({ ...valid, DATABASE_SSL: "false", PORT: "6000" })).toMatchObject({ DATABASE_SSL: false, PORT: 6000 });
  });

  it("names the missing key", () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("rejects a short svc key without echoing it", () => {
    const run = () => parseEnv({ ...valid, SVC_INTERNAL_KEY: "short-secret-value" });
    expect(run).toThrow(/SVC_INTERNAL_KEY: must be at least 32 characters/);
    expect(run).not.toThrow(/short-secret-value/);
  });
});
