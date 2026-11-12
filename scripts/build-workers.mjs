import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const backupDir = path.join(root, "src", "_api_backup");
const nextDir = path.join(root, ".next");

try {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, backupDir);
  }
  console.log("Building static export for Cloudflare Workers (out/)...");
  execSync("npx next build --webpack", {
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1" },
  });
  console.log("Static export complete in ./out");
} finally {
  if (fs.existsSync(backupDir)) {
    fs.renameSync(backupDir, apiDir);
  }
}
