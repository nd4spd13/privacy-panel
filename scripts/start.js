/**
 * Railway startup script.
 *
 * Railway mounts the persistent volume at the path set by DATABASE_URL.
 * This script ensures the data directory exists, seeds the database on
 * first boot, then starts Next.js.
 *
 * Set in Railway dashboard:
 *   DATABASE_URL  = /data/privacyfacts.db   (or wherever your volume is mounted)
 *   ANTHROPIC_API_KEY = sk-ant-...
 */

const { execSync } = require("child_process");
const { mkdirSync, existsSync, readFileSync } = require("fs");
const { dirname, join } = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_URL ?? "./data/privacyfacts.db";

// Ensure the database directory exists (Railway volumes are pre-mounted)
try {
  mkdirSync(dirname(dbPath), { recursive: true });
  console.log(`[start] Database directory ready: ${dirname(dbPath)}`);
} catch (err) {
  console.error("[start] Could not create DB directory:", err.message);
}

// Seed on first boot — apply if the companies table is empty
try {
  const db = new Database(dbPath);

  // Apply schema first (idempotent — uses CREATE TABLE IF NOT EXISTS)
  const schemaPath = join(__dirname, "../src/db/schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));

  const count = db.prepare("SELECT COUNT(*) as n FROM companies").get().n;
  if (count === 0) {
    console.log("[start] Empty database detected — applying seed data...");
    const seedPath = join(__dirname, "seed.sql");
    if (existsSync(seedPath)) {
      db.exec(readFileSync(seedPath, "utf8"));
      const seeded = db.prepare("SELECT COUNT(*) as n FROM companies").get().n;
      console.log(`[start] Seed applied: ${seeded} companies loaded.`);
    } else {
      console.warn("[start] seed.sql not found — starting with empty database.");
    }
  } else {
    console.log(`[start] Database has ${count} companies — skipping seed.`);
  }

  db.close();
} catch (err) {
  console.error("[start] Database init error:", err.message);
}

console.log("[start] Starting Next.js...");
execSync("node node_modules/.bin/next start -p ${PORT:-3000}", {
  stdio: "inherit",
  env: { ...process.env },
  shell: true,
});
