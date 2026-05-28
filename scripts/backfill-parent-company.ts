/**
 * Backfill parent_company column from names stored as "Product (Parent Corp)".
 *
 * Dry run by default. Pass --apply to commit changes.
 *
 *   npx tsx scripts/backfill-parent-company.ts
 *   npx tsx scripts/backfill-parent-company.ts --apply
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const DB_PATH =
  process.env.DATABASE_URL ?? join(dirname(fileURLToPath(import.meta.url)), "../data/privacypanel.db");

const APPLY = process.argv.includes("--apply");

const PARENT_RE = /^(.+?)\s*\(([^()]+(?:\([^()]+\))*[^()]*)\)\s*$/;

interface Row {
  id: number;
  slug: string;
  name: string;
  parent_company: string | null;
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure column exists (idempotent — applies if running before applyMigrations)
const cols = db.prepare("PRAGMA table_info(companies)").all() as { name: string }[];
if (!cols.some(c => c.name === "parent_company")) {
  db.exec("ALTER TABLE companies ADD COLUMN parent_company TEXT");
}

const rows = db.prepare("SELECT id, slug, name, parent_company FROM companies ORDER BY name").all() as Row[];

let changes = 0;

for (const row of rows) {
  const m = row.name.match(PARENT_RE);
  if (!m) continue;

  const newName = m[1].trim();
  const newParent = m[2].trim();

  if (newName === newParent) continue; // e.g. "Foo (Foo)" — nothing useful

  const nameChanged = newName !== row.name;
  const parentChanged = newParent !== (row.parent_company ?? "");

  if (!nameChanged && !parentChanged) continue;

  changes++;
  console.log(`${APPLY ? "UPDATE" : "WOULD UPDATE"} ${row.slug}`);
  if (nameChanged) console.log(`  name:           "${row.name}" → "${newName}"`);
  if (parentChanged) console.log(`  parent_company: "${row.parent_company ?? ""}" → "${newParent}"`);

  if (APPLY) {
    db.prepare(
      "UPDATE companies SET name = ?, parent_company = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?"
    ).run(newName, newParent, row.id);
  }
}

console.log(`\n${changes} companies ${APPLY ? "updated" : "would be updated"}.`);
if (!APPLY && changes > 0) console.log("Re-run with --apply to commit.");
db.close();
