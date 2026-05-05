#!/usr/bin/env tsx
/**
 * Backfill raw_text column in policies table from local PDF snapshots.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-policy-text.ts
 *   pnpm tsx scripts/backfill-policy-text.ts --dry-run
 *
 * Reads PDFs from the local snapshots directory, extracts text using pdf-parse,
 * and updates the policies table with the raw text content.
 */

// Stub server-only so tsx can import server modules
require("module").Module._cache = require("module").Module._cache || {};
if (!require.resolve("server-only")) {
  /* noop */
}
try { require("server-only"); } catch { /* stub for CLI */ }

import { readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { getDb, closeDb } from "../src/db/client";
import { parsePdfBuffer } from "../src/core/ingestion/pdf-parser";

const SNAPSHOTS_DIR = "/Users/csb/Documents/Claude/Projects/Privacy Panel Label/policies/snapshots";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();

  // Get all companies with their latest policy
  const companies = db.prepare(`
    SELECT c.id, c.slug, c.name, p.id as policy_id, p.raw_text
    FROM companies c
    JOIN policies p ON p.company_id = c.id
    WHERE p.id = (SELECT MAX(id) FROM policies WHERE company_id = c.id)
    ORDER BY c.slug
  `).all() as { id: number; slug: string; name: string; policy_id: number; raw_text: string | null }[];

  console.log(`Found ${companies.length} companies with policies`);

  // List available PDFs
  const pdfs = readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith(".pdf"));
  console.log(`Found ${pdfs.length} PDF snapshots in ${SNAPSHOTS_DIR}\n`);

  // Build slug → PDF filename map
  const pdfMap = new Map<string, string>();
  for (const pdf of pdfs) {
    // Format: {slug}-2026-03.pdf → slug
    const slug = basename(pdf, ".pdf").replace(/-\d{4}-\d{2}$/, "");
    pdfMap.set(slug, pdf);
  }

  let updated = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const company of companies) {
    const pdfFile = pdfMap.get(company.slug);

    if (!pdfFile) {
      console.log(`  SKIP ${company.slug} — no PDF snapshot found`);
      missing++;
      continue;
    }

    if (company.raw_text) {
      console.log(`  SKIP ${company.slug} — already has raw_text`);
      skipped++;
      continue;
    }

    const pdfPath = join(SNAPSHOTS_DIR, pdfFile);
    const buffer = readFileSync(pdfPath);
    const result = await parsePdfBuffer(buffer);

    if (!result.success) {
      console.log(`  FAIL ${company.slug} — ${result.error}`);
      failed++;
      continue;
    }

    const textLength = result.text.length;
    const pageCount = result.pages;

    if (DRY_RUN) {
      console.log(`  DRY  ${company.slug} — ${pageCount} pages, ${textLength.toLocaleString()} chars`);
    } else {
      db.prepare("UPDATE policies SET raw_text = ? WHERE id = ?").run(result.text, company.policy_id);
      console.log(`  OK   ${company.slug} — ${pageCount} pages, ${textLength.toLocaleString()} chars`);
    }
    updated++;
  }

  console.log(`\n${DRY_RUN ? "DRY RUN — " : ""}Results: ${updated} updated, ${skipped} already had text, ${missing} no PDF, ${failed} failed`);

  closeDb();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
