#!/usr/bin/env node
/**
 * export-new-seed-rows.js
 *
 * Reads the local SQLite database, finds any companies that are NOT already
 * represented in seed.sql, and appends INSERT OR IGNORE statements for them
 * (companies + policies + extractions) to scripts/seed.sql.
 *
 * Usage (run from repo root):
 *   node scripts/export-new-seed-rows.js
 *
 * Dry-run (print SQL without writing):
 *   node scripts/export-new-seed-rows.js --dry-run
 */

const Database = require("better-sqlite3");
const { readFileSync, appendFileSync, existsSync } = require("fs");
const { join, dirname } = require("path");

const ROOT = join(__dirname, "..");
const SEED_PATH = join(__dirname, "seed.sql");
const DB_PATH = process.env.DATABASE_URL ?? join(ROOT, "data/privacyfacts.db");
const DRY_RUN = process.argv.includes("--dry-run");

// ── 1. Read slugs already in seed.sql ────────────────────────────────────────

if (!existsSync(SEED_PATH)) {
  console.error("seed.sql not found at", SEED_PATH);
  process.exit(1);
}
if (!existsSync(DB_PATH)) {
  console.error("Database not found at", DB_PATH);
  console.error("Set DATABASE_URL or run from the repo root after ingest-snapshots completes.");
  process.exit(1);
}

const seedContent = readFileSync(SEED_PATH, "utf8");
const seededSlugs = new Set(
  [...seedContent.matchAll(/INSERT OR IGNORE INTO companies[^']*'([^']+)'/g)].map((m) => m[1])
);
console.log(`seed.sql already contains ${seededSlugs.size} companies.`);

// ── 2. Open DB and find new companies ────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

const newCompanies = db
  .prepare("SELECT * FROM companies ORDER BY id")
  .all()
  .filter((c) => !seededSlugs.has(c.slug));

if (newCompanies.length === 0) {
  console.log("Nothing new to export — seed.sql is already up to date.");
  db.close();
  process.exit(0);
}

console.log(`Found ${newCompanies.length} new companies to export: ${newCompanies.map((c) => c.slug).join(", ")}`);

// ── 3. Build SQL ──────────────────────────────────────────────────────────────

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const lines = [
  "",
  `-- ─── Batch 2: ${newCompanies.length} companies added ${new Date().toISOString().slice(0, 10)} ──────────────────────────────────────────`,
  "",
];

for (const co of newCompanies) {
  // Company row
  lines.push(
    `INSERT OR IGNORE INTO companies (id, slug, name, domain, created_at, updated_at) VALUES ` +
    `(${esc(co.id)}, ${esc(co.slug)}, ${esc(co.name)}, ${esc(co.domain)}, ${esc(co.created_at)}, ${esc(co.updated_at)});`
  );

  // Policy rows for this company
  const policies = db.prepare("SELECT * FROM policies WHERE company_id = ? ORDER BY id").all(co.id);
  for (const po of policies) {
    lines.push(
      `INSERT OR IGNORE INTO policies (id, company_id, url, content_hash, fetched_at, created_at) VALUES ` +
      `(${esc(po.id)}, ${esc(po.company_id)}, ${esc(po.url)}, ${esc(po.content_hash)}, ${esc(po.fetched_at)}, ${esc(po.created_at)});`
    );

    // Extraction rows for this policy
    const extractions = db.prepare("SELECT * FROM extractions WHERE policy_id = ? ORDER BY id").all(po.id);
    for (const ex of extractions) {
      lines.push(
        `INSERT OR IGNORE INTO extractions ` +
        `(id, policy_id, company_id, facts_json, score, letter, grade_label, grade_color, rubric_version, breakdown_json, model, input_tokens, output_tokens, latency_ms, chunked, created_at) VALUES ` +
        `(${esc(ex.id)}, ${esc(ex.policy_id)}, ${esc(ex.company_id)}, ${esc(ex.facts_json)}, ` +
        `${esc(ex.score)}, ${esc(ex.letter)}, ${esc(ex.grade_label)}, ${esc(ex.grade_color)}, ` +
        `${esc(ex.rubric_version)}, ${esc(ex.breakdown_json)}, ${esc(ex.model)}, ` +
        `${esc(ex.input_tokens)}, ${esc(ex.output_tokens)}, ${esc(ex.latency_ms)}, ${esc(ex.chunked)}, ${esc(ex.created_at)});`
      );
    }
  }

  lines.push(""); // blank line between companies
}

db.close();

const sql = lines.join("\n");

// ── 4. Write or print ─────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("\n── DRY RUN — SQL that would be appended to seed.sql ──\n");
  console.log(sql.slice(0, 2000) + (sql.length > 2000 ? `\n… (${sql.length} bytes total)` : ""));
} else {
  appendFileSync(SEED_PATH, sql);
  console.log(`\n✓ Appended ${newCompanies.length} companies to seed.sql (${sql.length} bytes added).`);
  console.log("Next: git add scripts/seed.sql && git commit -m 'Seed 35 new companies' && git push");
}
