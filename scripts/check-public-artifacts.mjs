/**
 * CI guard: fail the build if score/rubric/data artifacts reappear under public/.
 *
 * Run automatically via the "prebuild" npm script, or manually:
 *   node scripts/check-public-artifacts.mjs
 *
 * These paths were removed in CRS-186 because:
 *  - public/data/companies* contained fabricated source quotes attributed to named companies
 *  - public/rubric/v1.yaml exposed scoring weights before scores are publicly launched
 *  - public/data/policy-provenance.json made false source_method claims
 *
 * To intentionally restore one of these (e.g. rubric at launch), remove it from
 * FORBIDDEN below and update this comment.
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  "public/data/companies.json",
  "public/data/companies",
  "public/data/policy-index.json",
  "public/data/policy-provenance.json",
  "public/rubric",
];

let failed = false;
for (const rel of FORBIDDEN) {
  if (existsSync(join(ROOT, rel))) {
    console.error(`\n  ERROR: Forbidden artifact found: ${rel}`);
    console.error(`  See scripts/check-public-artifacts.mjs for context.\n`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("check-public-artifacts: OK");
}
