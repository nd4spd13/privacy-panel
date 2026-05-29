/**
 * Quote-integrity audit runner (CRS-187).
 *
 * Audits every company's latest extraction: checks that each stored `sourceQuote`
 * is verbatim from the policy text stored in the DB (CRS-19), reports flagged /
 * unverifiable quotes, and (with --apply) collapses "policy is silent" notes to a
 * single canonical boilerplate.
 *
 *   npx tsx scripts/audit-quotes.ts                 # dry-run report (read-only)
 *   npx tsx scripts/audit-quotes.ts --apply         # rewrite SILENCE quotes → boilerplate
 *   npx tsx scripts/audit-quotes.ts --ci            # exit 1 if any FLAGGED quotes exist
 *   npx tsx scripts/audit-quotes.ts --json out.json # write the full report JSON here
 *
 * FLAGGED quotes are NEVER auto-fixed — they indicate fabricated or paraphrased
 * evidence and must be re-extracted (CRS-174). This runner only normalizes the
 * legitimate "policy is silent" notes.
 */

import Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  auditFacts,
  normalizeSilenceQuotes,
  type QuoteFinding,
  type QuoteStatus,
} from "../src/core/audit/quote-audit";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_URL ?? join(HERE, "../data/privacypanel.db");

const APPLY = process.argv.includes("--apply");
const CI = process.argv.includes("--ci");
const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT =
  jsonIdx !== -1 && process.argv[jsonIdx + 1]
    ? process.argv[jsonIdx + 1]
    : join(HERE, "../results/quote-audit.json");

interface Row {
  extraction_id: number;
  company_id: number;
  slug: string;
  name: string;
  facts_json: string;
  raw_text: string | null;
}

interface CompanyReport {
  slug: string;
  name: string;
  extractionId: number;
  hasPolicyText: boolean;
  counts: Record<QuoteStatus, number>;
  findings: QuoteFinding[];
  replaced: number;
}

function truncate(s: string, n = 90): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? `${oneLine.slice(0, n - 1)}…` : oneLine;
}

const db = new Database(DB_PATH, { readonly: !APPLY });

const rows = db
  .prepare(
    `SELECT e.id AS extraction_id, e.company_id, e.facts_json,
            c.slug, c.name, p.raw_text
       FROM extractions e
       JOIN companies c ON c.id = e.company_id
       LEFT JOIN policies p ON p.id = e.policy_id
      WHERE e.id IN (SELECT MAX(id) FROM extractions GROUP BY company_id)
      ORDER BY c.name`
  )
  .all() as Row[];

const updateStmt = db.prepare("UPDATE extractions SET facts_json = ? WHERE id = ?");

const reports: CompanyReport[] = [];
const totals: Record<QuoteStatus, number> = {
  verbatim: 0,
  silence: 0,
  boilerplate: 0,
  flagged: 0,
  unverifiable: 0,
};
let totalReplaced = 0;
const parseErrors: { slug: string; error: string }[] = [];

for (const row of rows) {
  let facts: unknown;
  try {
    facts = JSON.parse(row.facts_json);
  } catch (e) {
    parseErrors.push({ slug: row.slug, error: (e as Error).message });
    continue;
  }

  const { findings, counts } = auditFacts(facts, row.raw_text);
  for (const s of Object.keys(totals) as QuoteStatus[]) totals[s] += counts[s];

  let replaced = 0;
  if (APPLY) {
    const result = normalizeSilenceQuotes(facts, row.raw_text);
    replaced = result.replaced;
    if (replaced > 0) {
      updateStmt.run(JSON.stringify(result.facts), row.extraction_id);
      totalReplaced += replaced;
    }
  }

  reports.push({
    slug: row.slug,
    name: row.name,
    extractionId: row.extraction_id,
    hasPolicyText: row.raw_text !== null,
    counts,
    findings,
    replaced,
  });
}

db.close();

// ─── Console report ─────────────────────────────────────────────────────────

const totalQuotes = (Object.values(totals) as number[]).reduce((a, b) => a + b, 0);

console.log(`\nQuote-integrity audit  ·  ${DB_PATH}`);
console.log(`${rows.length} companies · ${totalQuotes} quotes audited${APPLY ? " · APPLY mode" : " · dry run"}\n`);

// Companies with problems first, worst (most flagged) at the top.
const flaggedCompanies = reports
  .filter((r) => r.counts.flagged > 0 || r.counts.unverifiable > 0)
  .sort((a, b) => b.counts.flagged - a.counts.flagged);

for (const r of flaggedCompanies) {
  const tags: string[] = [];
  if (r.counts.flagged) tags.push(`${r.counts.flagged} flagged`);
  if (r.counts.unverifiable) tags.push(`${r.counts.unverifiable} unverifiable`);
  console.log(`■ ${r.name} (${r.slug}) — ${tags.join(", ")}${r.hasPolicyText ? "" : "  [no policy text on file]"}`);

  for (const f of r.findings) {
    if (f.status !== "flagged") continue;
    const val = f.value === null ? "" : `  value=${f.value}`;
    console.log(`    ✗ ${f.path}${val}`);
    console.log(`      ${f.reason}`);
    console.log(`      "${truncate(f.quote)}"`);
  }
  console.log("");
}

console.log("── Summary ─────────────────────────────");
console.log(`  verbatim:     ${totals.verbatim}`);
console.log(`  silence:      ${totals.silence}`);
console.log(`  boilerplate:  ${totals.boilerplate}`);
console.log(`  flagged:      ${totals.flagged}`);
console.log(`  unverifiable: ${totals.unverifiable}`);
if (APPLY) console.log(`\n  ${totalReplaced} silence quote(s) rewritten to boilerplate.`);
else if (totals.silence > 0) console.log(`\n  Run with --apply to rewrite ${totals.silence} silence quote(s) to boilerplate.`);
if (parseErrors.length) console.log(`\n  ${parseErrors.length} extraction(s) failed to parse: ${parseErrors.map((p) => p.slug).join(", ")}`);

// ─── JSON artifact ──────────────────────────────────────────────────────────

mkdirSync(dirname(JSON_OUT), { recursive: true });
writeFileSync(
  JSON_OUT,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), db: DB_PATH, apply: APPLY, totals, totalReplaced, parseErrors, reports },
    null,
    2
  )
);
console.log(`\nFull report: ${JSON_OUT}`);

// ─── CI gate ────────────────────────────────────────────────────────────────

if (CI && totals.flagged > 0) {
  console.error(`\nFAIL: ${totals.flagged} flagged quote(s) — fabricated or unlocated evidence must be re-extracted.`);
  process.exit(1);
}
