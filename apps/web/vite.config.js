import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.test.{js,jsx}"],
    css: false,
    // Form-heavy jsdom tests are slow when web, api, and svc tests run in parallel (pnpm test).
    testTimeout: 15000,
    // Fake values so src/lib/supabase.js can create its client; network calls are mocked in tests.
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      VITE_API_URL: "http://api.test/api",
    },
  },
});
