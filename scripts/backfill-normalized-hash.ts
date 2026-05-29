/**
 * Backfill policies.normalized_hash (+ normalizer) from raw_text using norm-v1 (CRS-199).
 *
 * normalized_hash = sha256(norm-v1(raw_text)) — the provenance / verification fingerprint.
 * Distinct from policies.content_hash (the raw-text hash); we don't touch that.
 *
 * Dry-run by default; pass --apply to write.
 *   npx tsx scripts/backfill-normalized-hash.ts            # dry run
 *   npx tsx scripts/backfill-normalized-hash.ts --apply    # write
 */

import { getDb } from "../src/db/client";
import { normalizedHash, NORMALIZER_VERSION } from "../src/core/text/norm-v1";

const APPLY = process.argv.includes("--apply");

/**
 * Failed-fetch companies whose raw_text is NOT the real policy (nav/footer captured).
 * Skip until re-fetched (CRS-197) so we never stamp a provenance hash on garbage text.
 * CRS-197 will replace this hardcoded list with a corpus-wide raw-text quality scan.
 */
const SKIP_SLUGS = new Set<string>(["affirm"]);

interface Row {
  id: number;
  slug: string;
  raw_text: string | null;
  normalized_hash: string | null;
  normalizer: string | null;
}

const db = getDb(); // applies the v4 migration, so the columns exist before we query them

const rows = db
  .prepare(
    `SELECT p.id, c.slug, p.raw_text, p.normalized_hash, p.normalizer
       FROM policies p JOIN companies c ON c.id = p.company_id
      ORDER BY c.slug`
  )
  .all() as Row[];

const update = db.prepare(
  "UPDATE policies SET normalized_hash = ?, normalizer = ? WHERE id = ?"
);

let updated = 0;
let alreadyCurrent = 0;
let noText = 0;
let skipped = 0;

for (const row of rows) {
  if (!row.raw_text) {
    noText++;
    continue;
  }
  if (SKIP_SLUGS.has(row.slug)) {
    skipped++;
    continue;
  }
  const hash = normalizedHash(row.raw_text);
  if (row.normalized_hash === hash && row.normalizer === NORMALIZER_VERSION) {
    alreadyCurrent++;
    continue;
  }
  if (APPLY) update.run(hash, NORMALIZER_VERSION, row.id);
  updated++;
}

console.log(`\nnormalized-hash backfill (${NORMALIZER_VERSION})  ${APPLY ? "· APPLY" : "· dry run"}`);
console.log(`  policies:                 ${rows.length}`);
console.log(`  ${APPLY ? "updated" : "would update"}:            ${updated}`);
console.log(`  already current:          ${alreadyCurrent}`);
console.log(`  skipped (no raw_text):    ${noText}`);
console.log(`  skipped (failed fetch):   ${skipped}${skipped ? `  [${[...SKIP_SLUGS].join(", ")}]` : ""}`);
if (!APPLY && updated > 0) console.log(`\n  Re-run with --apply to write.`);
