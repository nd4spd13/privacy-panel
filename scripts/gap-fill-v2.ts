#!/usr/bin/env tsx
/**
 * Gap-fill v2 extraction: extract only the v2-only fields for all companies
 * that still have v1 extractions, then save as new v2 extraction rows.
 *
 * Usage:
 *   pnpm tsx scripts/gap-fill-v2.ts
 *   pnpm tsx scripts/gap-fill-v2.ts --dry-run        # Preview without calling API
 *   pnpm tsx scripts/gap-fill-v2.ts --limit 5         # Process only 5 companies
 *   pnpm tsx scripts/gap-fill-v2.ts --slug airbnb     # Process a single company
 *   pnpm tsx scripts/gap-fill-v2.ts --resume          # Skip companies that already have v2 extractions
 */

// Stub server-only so tsx can import server modules
require("../cli/server-only-shim.cjs");

import { getDb, closeDb } from "../src/db/client";
import { extractGapFill, mergeGapFill } from "../src/core/extraction/gap-fill";
import { migrateV1ToV2 } from "../src/core/extraction/validator";
import { score } from "../src/core/scoring/engine";
import { loadRubricOrThrow } from "../src/core/scoring/rubric";
import { join } from "path";
import { SCHEMA_VERSION } from "../src/core/schema/privacy-panel.schema";
import type { PrivacyPanel } from "../src/core/schema/types";

const DRY_RUN = process.argv.includes("--dry-run");
const RESUME = process.argv.includes("--resume");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;
const slugIdx = process.argv.indexOf("--slug");
const SLUG_FILTER = slugIdx !== -1 ? process.argv[slugIdx + 1] : null;

interface CompanyRow {
  id: number;
  slug: string;
  name: string;
  policy_id: number;
  raw_text: string | null;
  extraction_id: number;
  facts_json: string;
  schema_version: string;
}

async function main() {
  const db = getDb();
  const rubric = loadRubricOrThrow(join(process.cwd(), "src/core/scoring/rubric.v2.yaml"));

  // Find all companies with their latest extraction and policy text
  let query = `
    SELECT
      c.id, c.slug, c.name,
      p.id as policy_id, p.raw_text,
      e.id as extraction_id, e.facts_json,
      json_extract(e.facts_json, '$.metadata.schemaVersion') as schema_version
    FROM companies c
    JOIN policies p ON p.company_id = c.id
      AND p.id = (SELECT MAX(id) FROM policies WHERE company_id = c.id)
    JOIN extractions e ON e.company_id = c.id
      AND e.id = (SELECT MAX(id) FROM extractions WHERE company_id = c.id)
  `;

  if (SLUG_FILTER) {
    query += ` WHERE c.slug = '${SLUG_FILTER}'`;
  }

  query += ` ORDER BY c.slug`;

  const companies = db.prepare(query).all() as CompanyRow[];

  console.log(`Found ${companies.length} companies with extractions\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let noText = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const company of companies) {
    if (processed >= LIMIT) break;

    // Skip if already v2 and --resume is set
    if (RESUME && company.schema_version === SCHEMA_VERSION) {
      console.log(`  SKIP ${company.slug} — already v2`);
      skipped++;
      continue;
    }

    // Need raw_text to do gap-fill
    if (!company.raw_text) {
      console.log(`  SKIP ${company.slug} — no raw_text available`);
      noText++;
      continue;
    }

    // Parse existing extraction and migrate to v2 if needed
    let existingFacts: PrivacyPanel;
    const rawFacts = JSON.parse(company.facts_json);
    if (rawFacts.metadata?.schemaVersion === "1.0.0") {
      const migrated = migrateV1ToV2(rawFacts);
      if (!migrated.success) {
        console.log(`  FAIL ${company.slug} — v1 migration failed: ${migrated.error}`);
        failed++;
        continue;
      }
      existingFacts = migrated.data;
    } else {
      existingFacts = rawFacts as PrivacyPanel;
    }

    if (DRY_RUN) {
      console.log(`  DRY  ${company.slug} — would gap-fill (${(company.raw_text.length / 1000).toFixed(0)}K chars)`);
      processed++;
      continue;
    }

    // Run gap-fill extraction
    console.log(`  ...  ${company.slug} — extracting (${(company.raw_text.length / 1000).toFixed(0)}K chars)`);
    const result = await extractGapFill(company.raw_text, company.name);

    if (!result.success) {
      console.log(`  FAIL ${company.slug} — ${result.error}`);
      failed++;
      continue;
    }

    // Merge gap-fill into existing facts
    const mergedFacts = mergeGapFill(existingFacts, result.data);

    // Re-score with v2 rubric
    const gradeResult = score(mergedFacts, rubric);

    // Insert new extraction row
    db.prepare(
      `INSERT INTO extractions
        (policy_id, company_id, facts_json, score, letter, grade_label, grade_color,
         rubric_version, breakdown_json, model, input_tokens, output_tokens, latency_ms, chunked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      company.policy_id,
      company.id,
      JSON.stringify(mergedFacts),
      gradeResult.score,
      gradeResult.letter,
      gradeResult.label,
      gradeResult.color,
      gradeResult.rubricVersion,
      JSON.stringify(gradeResult.breakdown),
      "gap-fill-v2",
      result.inputTokens,
      result.outputTokens,
      result.latencyMs,
      0
    );

    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;

    console.log(
      `  OK   ${company.slug} — ${gradeResult.letter} (${gradeResult.score}/100) ` +
      `[${result.inputTokens}+${result.outputTokens} tokens, ${result.latencyMs}ms]`
    );

    processed++;

    // Small delay to avoid rate limiting
    if (processed < LIMIT && processed < companies.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const estimatedCost = (totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000;

  console.log(`\n${DRY_RUN ? "DRY RUN — " : ""}Results:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped} (already v2)`);
  console.log(`  No text:   ${noText}`);
  console.log(`  Failed:    ${failed}`);
  if (!DRY_RUN && totalInputTokens > 0) {
    console.log(`  Tokens:    ${totalInputTokens.toLocaleString()} in + ${totalOutputTokens.toLocaleString()} out`);
    console.log(`  Est. cost: $${estimatedCost.toFixed(2)}`);
  }

  closeDb();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
