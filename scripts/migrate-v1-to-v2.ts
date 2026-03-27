/**
 * migrate-v1-to-v2.ts
 *
 * Migrates all extractions in the database from schema v1.0.0 to v2.0.0.
 * Re-scores each company with rubric v2 and optionally exports an updated seed.sql.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-v1-to-v2.ts
 *   pnpm tsx scripts/migrate-v1-to-v2.ts --dry-run      # preview without writing
 *   pnpm tsx scripts/migrate-v1-to-v2.ts --export-seed  # also regenerate seed.sql
 */

import Database from "better-sqlite3";
import { join } from "path";
import { writeFileSync } from "fs";
import { migrateV1ToV2 } from "../src/core/extraction/validator";
import { score } from "../src/core/scoring/engine";
import { loadRubricOrThrow } from "../src/core/scoring/rubric";
import type { V2Rubric } from "../src/core/scoring/rubric";
import type { GradeResult } from "../src/core/scoring/engine";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const EXPORT_SEED = args.includes("--export-seed");
const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "data/privacyfacts.db");
const RUBRIC_PATH = join(process.cwd(), "src/core/scoring/rubric.v2.yaml");

// ─── Main ─────────────────────────────────────────────────────────────────────

interface ExtractionRow {
  id: number;
  company_id: number;
  policy_id: number;
  facts_json: string;
  score: number;
  letter: string;
  grade_label: string;
  grade_color: string;
  rubric_version: string;
  breakdown_json: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  chunked: number;
  created_at: string;
}

async function main() {
  console.log(`\n=== Privacy Facts v1 → v2 Migration ===`);
  console.log(`Database:   ${DB_PATH}`);
  console.log(`Rubric:     ${RUBRIC_PATH}`);
  console.log(`Mode:       ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  const rubric = loadRubricOrThrow(RUBRIC_PATH) as V2Rubric;
  if (rubric.version !== "2") {
    throw new Error("Expected rubric v2");
  }

  const db = new Database(DB_PATH, { readonly: DRY_RUN });

  // Fetch all extractions with v1 schema
  const rows = db
    .prepare("SELECT * FROM extractions WHERE rubric_version = '1' OR facts_json LIKE '%\"schemaVersion\":\"1.0.0\"%' ORDER BY id")
    .all() as ExtractionRow[];

  console.log(`Found ${rows.length} v1 extraction(s) to migrate.\n`);

  const v1Grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const v2Grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const needsReExtractionIds: number[] = [];
  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    const v1Score = row.score;
    const v1Letter = row.letter;
    v1Grades[v1Letter] = (v1Grades[v1Letter] ?? 0) + 1;

    let v1Raw: unknown;
    try {
      v1Raw = JSON.parse(row.facts_json);
    } catch {
      console.error(`  [SKIP] ID ${row.id}: failed to parse facts_json`);
      failed++;
      continue;
    }

    const migrationResult = migrateV1ToV2(v1Raw);
    if (!migrationResult.success) {
      console.error(`  [FAIL] ID ${row.id}: ${migrationResult.error}`);
      failed++;
      continue;
    }

    const { data: v2Facts, needsReExtraction } = migrationResult;

    // Re-score with v2 rubric
    let v2Grade: GradeResult;
    try {
      v2Grade = score(v2Facts, rubric);
    } catch (err) {
      console.error(`  [FAIL] ID ${row.id}: scoring failed — ${(err as Error).message}`);
      failed++;
      continue;
    }

    v2Grades[v2Grade.letter] = (v2Grades[v2Grade.letter] ?? 0) + 1;
    if (needsReExtraction.length > 0) {
      needsReExtractionIds.push(row.id);
    }

    const letterChange = v1Letter !== v2Grade.letter ? ` (${v1Letter} → ${v2Grade.letter})` : "";
    console.log(`  [${DRY_RUN ? "DRY" : "OK"}] ID ${row.id}: score ${v1Score} → ${v2Grade.score}${letterChange}`);

    if (!DRY_RUN) {
      db.prepare(`
        UPDATE extractions SET
          facts_json    = ?,
          score         = ?,
          letter        = ?,
          grade_label   = ?,
          grade_color   = ?,
          rubric_version = ?,
          breakdown_json = ?
        WHERE id = ?
      `).run(
        JSON.stringify(v2Facts),
        v2Grade.score,
        v2Grade.letter,
        v2Grade.label,
        v2Grade.color,
        v2Grade.rubricVersion,
        JSON.stringify(v2Grade.breakdown),
        row.id
      );
    }

    migrated++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`Migrated:  ${migrated}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Needs re-extraction: ${needsReExtractionIds.length} records (IDs: ${needsReExtractionIds.slice(0, 10).join(", ")}${needsReExtractionIds.length > 10 ? "…" : ""})`);

  console.log(`\n── Grade Distribution ───────────────────`);
  console.log(`        V1     V2`);
  for (const letter of ["A", "B", "C", "D", "F"]) {
    const v1Count = v1Grades[letter] ?? 0;
    const v2Count = v2Grades[letter] ?? 0;
    const change = v2Count > v1Count ? `↑ +${v2Count - v1Count}` : v2Count < v1Count ? `↓ -${v1Count - v2Count}` : "  =";
    console.log(`  ${letter}:    ${String(v1Count).padStart(3)}   ${String(v2Count).padStart(3)}   ${change}`);
  }

  // ── Export seed.sql ────────────────────────────────────────────────────

  if (EXPORT_SEED && !DRY_RUN) {
    const seedPath = join(process.cwd(), "scripts/seed.sql");
    const companies = db.prepare("SELECT * FROM companies ORDER BY id").all() as Record<string, unknown>[];
    const allExtractions = db.prepare("SELECT * FROM extractions ORDER BY id").all() as ExtractionRow[];
    const policies = db.prepare("SELECT * FROM policies ORDER BY id").all() as Record<string, unknown>[];

    const lines: string[] = [
      "-- Auto-generated seed.sql (v2 schema)",
      `-- Generated: ${new Date().toISOString()}`,
      "-- Run: sqlite3 data/privacyfacts.db < scripts/seed.sql",
      "",
      "DELETE FROM extractions;",
      "DELETE FROM policies;",
      "DELETE FROM companies;",
      "",
    ];

    for (const c of companies) {
      lines.push(`INSERT OR IGNORE INTO companies (id, name, slug, domain, created_at) VALUES (${c["id"]}, ${sqlStr(c["name"])}, ${sqlStr(c["slug"])}, ${sqlStr(c["domain"])}, ${sqlStr(c["created_at"])});`);
    }
    lines.push("");
    for (const p of policies) {
      lines.push(`INSERT OR IGNORE INTO policies (id, company_id, url, content_hash, created_at) VALUES (${p["id"]}, ${p["company_id"]}, ${sqlStr(p["url"])}, ${sqlStr(p["content_hash"])}, ${sqlStr(p["created_at"])});`);
    }
    lines.push("");
    for (const e of allExtractions) {
      lines.push(`INSERT OR IGNORE INTO extractions (id, policy_id, company_id, facts_json, score, letter, grade_label, grade_color, rubric_version, breakdown_json, model, input_tokens, output_tokens, latency_ms, chunked, created_at) VALUES (${e.id}, ${e.policy_id}, ${e.company_id}, ${sqlStr(e.facts_json)}, ${e.score}, ${sqlStr(e.letter)}, ${sqlStr(e.grade_label)}, ${sqlStr(e.grade_color)}, ${sqlStr(e.rubric_version)}, ${sqlStr(e.breakdown_json)}, ${sqlStr(e.model)}, ${e.input_tokens ?? "NULL"}, ${e.output_tokens ?? "NULL"}, ${e.latency_ms ?? "NULL"}, ${e.chunked}, ${sqlStr(e.created_at)});`);
    }

    writeFileSync(seedPath, lines.join("\n") + "\n");
    console.log(`\nExported updated seed to: ${seedPath}`);
  }

  db.close();
  console.log(`\nDone.${DRY_RUN ? " (Dry run — no changes written)" : ""}`);
}

function sqlStr(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
