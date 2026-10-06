// Runs the svc venv python on Windows/macOS/Linux (used by apps/svc/package.json).
// Usage (from apps/svc): node ../../scripts/run-py.mjs -m uvicorn app.main:app ...
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const venv = path.resolve(process.cwd(), ".venv");
const python = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

if (!existsSync(python)) {
  console.error(`[svc] venv not found at ${python}. Create it and install requirements.txt first.`);
  process.exit(1);
}

const child = spawn(python, process.argv.slice(2), { stdio: "inherit" });
child.on("error", (error) => {
  console.error(`[svc] could not start python: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
