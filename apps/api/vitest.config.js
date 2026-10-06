import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    // Fake values so src/config/env.js validates; db and Supabase are mocked in each test.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DATABASE_SSL: "false",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SECRET_KEY: "test-secret-key",
      SVC_URL: "http://127.0.0.1:8000",
      SVC_INTERNAL_KEY: "test-internal-key-0123456789abcdef",
    },
  },
});
