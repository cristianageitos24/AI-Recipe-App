#!/usr/bin/env node
/**
 * Starts the Next.js dev server and video worker in separate processes.
 * Windows: runs dev-all.bat (two separate cmd windows).
 * Other OS: prints instructions to run dev and worker in two terminals.
 * See WORKERS.md for details.
 */

const { execSync } = require("child_process");
const path = require("path");

const isWindows = process.platform === "win32";
const root = path.resolve(__dirname, "..");

if (isWindows) {
  execSync("cmd /c dev-all.bat", { cwd: root, stdio: "inherit" });
} else {
  console.log("Run the dev server and worker in two separate terminals:\n");
  console.log("  Terminal 1: npm run dev");
  console.log("  Terminal 2: npm run worker:video\n");
  console.log("From the next-app folder. See WORKERS.md for details.");
}
