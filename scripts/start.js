/**
 * Railway startup script.
 *
 * Railway mounts the persistent volume at the path set by DATABASE_URL.
 * This script ensures the data directory exists before starting Next.js.
 *
 * Set in Railway dashboard:
 *   DATABASE_URL  = /data/privacyfacts.db   (or wherever your volume is mounted)
 *   ANTHROPIC_API_KEY = sk-ant-...
 */

const { execSync } = require("child_process");
const { mkdirSync } = require("fs");
const { dirname } = require("path");

const dbPath = process.env.DATABASE_URL ?? "./data/privacyfacts.db";

// Ensure the database directory exists (Railway volumes are pre-mounted)
try {
  mkdirSync(dirname(dbPath), { recursive: true });
  console.log(`[start] Database directory ready: ${dirname(dbPath)}`);
} catch (err) {
  console.error("[start] Could not create DB directory:", err.message);
}

console.log("[start] Starting Next.js...");
execSync("node node_modules/.bin/next start -p ${PORT:-3000}", {
  stdio: "inherit",
  env: { ...process.env },
  shell: true,
});
