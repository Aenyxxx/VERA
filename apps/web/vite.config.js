import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// apps/web, wherever `pnpm dev` is started from.
const webDir = fileURLToPath(new URL(".", import.meta.url));

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

  // Dev only: teammates open the app through a VS Code dev tunnel that forwards port 5173 alone.
  server: {
    allowedHosts: [".devtunnels.ms"],
    // Same origin for the browser (no CORS); the API port 5000 stays private. Needs VITE_API_URL=/api.
    proxy: { "/api": "http://localhost:5000" },
    fs: {
      // Serve only what the web app needs (the default is the whole monorepo); Vite's default .env deny list stays.
      allow: [webDir, path.resolve(webDir, "../../packages/shared"), path.resolve(webDir, "../../node_modules")],
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
