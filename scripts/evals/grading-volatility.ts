#!/usr/bin/env tsx
/**
 * Grading sensitivity: flip individual dataSharing BooleanPractice values to true
 * (from false) on canonical gold fixtures and observe v2 score / letter changes.
 *
 * Usage: pnpm eval:volatility
 */
require("../../cli/server-only-shim.cjs");

import { join } from "path";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import type { V2Rubric } from "../../src/core/scoring/rubric";
import { SCHEMA_VERSION } from "../../src/core/schema/privacy-panel.schema";
import { buildSystemPrompt } from "../../src/core/extraction/prompts";
import { MODEL } from "../../src/lib/anthropic";
import { CANONICAL_POLICY_IDS, loadGoldExtraction } from "../../evals/lib/dataset";
import { buildRunManifest, ensureResultsDir, rubricVersionFromYaml } from "../../evals/lib/manifest";
import { writeEvalArtifacts, type EvalReportInput, type PerPolicyBlock } from "../../evals/lib/report";
import type { PrivacyPanel } from "../../src/core/schema/types";

const repoRoot = join(__dirname, "../..");
const rubricPath = join(repoRoot, "src/core/scoring/rubric.v2.yaml");

const DATA_SHARING_KEYS: (keyof PrivacyPanel["dataSharing"])[] = [
  "soldToThirdParties",
  "sharedForAdvertising",
  "crossSiteTracking",
  "usedForProfiling",
  "usedToTrainAI",
  "disclosedToLawEnforcement",
];

async function main(): Promise<void> {
  const rubric = loadRubricOrThrow(rubricPath) as V2Rubric;
  const rubricVersion = rubricVersionFromYaml(rubricPath);
  const systemPrompt = buildSystemPrompt();
  const outDir = ensureResultsDir(repoRoot);

  const tableRows: string[] = [];
  tableRows.push("## Grade volatility map (dataSharing flips false → true)");
  tableRows.push("");
  tableRows.push("| Policy | Field perturbed | Baseline score | New score | Δ | Letters |");
  tableRows.push("|--------|-----------------|----------------|-----------|---|---------|");

  const deltas: { label: string; delta: number }[] = [];
  const perPolicy: PerPolicyBlock[] = [];

  for (const id of CANONICAL_POLICY_IDS) {
    const base = loadGoldExtraction(repoRoot, id);
    const baseline = score(base, rubric);
    const company = base.metadata.companyName;

    const fieldRows: string[] = [];
    for (const field of DATA_SHARING_KEYS) {
      const cur = base.dataSharing[field].value;
      if (cur !== false) continue;
      const p = structuredClone(base);
      p.dataSharing[field] = {
        value: true,
        confidence: 1,
        sourceQuote: `(synthetic eval — force ${String(field)} true)`,
      };
      const after = score(p, rubric);
      const delta = after.score - baseline.score;
      deltas.push({ label: `${id}.${String(field)}`, delta });
      tableRows.push(
        `| ${id} | \`dataSharing.${String(field)}\` | ${baseline.score} | ${after.score} | ${delta} | ${baseline.letter} → ${after.letter} |`
      );
      fieldRows.push(`Flipping **dataSharing.${String(field)}** to true moves score by **${delta}** (→ ${after.letter}).`);
    }

    const bullets = [`Baseline v2 score **${baseline.score}** (${baseline.letter}).`];
    if (fieldRows.length > 0) {
      bullets.push(...fieldRows.slice(0, 6));
    } else {
      bullets.push("No `dataSharing` fields were false on this fixture — no false→true flips applied.");
    }

    perPolicy.push({
      id,
      title: `${company} (${id})`,
      pass: true,
      gradeLetter: baseline.letter,
      score: baseline.score,
      bullets,
      mismatches: [],
    });
  }

  tableRows.push("");
  deltas.sort((a, b) => a.delta - b.delta);
  const top = deltas.slice(0, 5);
  const narrative =
    top.length > 0
      ? `Largest downward score moves from single-field flips: ${top.map((t) => `${t.label} (${t.delta})`).join("; ")}.`
      : "No false-valued dataSharing fields to flip on these fixtures.";

  const manifest = buildRunManifest({
    schemaVersion: SCHEMA_VERSION,
    rubricVersion,
    modelId: MODEL,
    systemPrompt,
    datasetPolicyIds: [...CANONICAL_POLICY_IDS],
  });

  const report: EvalReportInput = {
    overallPass: true,
    title: "Grading volatility (synthetic single-field perturbations)",
    headerLines: {
      Result: "PASS",
      "Output directory": outDir,
      Rubric: `v${rubricVersion}`,
      Note: "Informational only — no pass/fail gates on rubric sensitivity",
    },
    executiveBullets: [
      "Single-field **false → true** perturbations on gold `dataSharing` practices to expose high-leverage deductions.",
      narrative,
    ],
    gates: [
      {
        name: "Analysis complete",
        threshold: "n/a",
        observed: "ok",
        pass: true,
      },
    ],
    perPolicy,
    consistencyMarkdown: tableRows.join("\n") + "\n\n### Narrative\n\n" + narrative,
    failuresAppendix: [],
  };

  const metrics = { deltas: deltas.sort((a, b) => a.delta - b.delta) };
  const paths = writeEvalArtifacts(outDir, report, metrics, manifest);
  // eslint-disable-next-line no-console
  console.log("\x1b[32mPASS\x1b[0m — grading volatility map.", `Report: ${paths.reportPath}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
