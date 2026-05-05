#!/usr/bin/env tsx
/**
 * Prompt A/B: baseline system prompt vs eval variant B on canonical fixtures.
 * Requires ANTHROPIC_API_KEY (two API calls per policy).
 *
 * Usage: pnpm eval:ab [--verbose]
 */
require("../../cli/server-only-shim.cjs");

import { join } from "path";
import { extract } from "../../src/core/extraction/extractor";
import { buildSystemPrompt, buildSystemPromptEvalVariantB } from "../../src/core/extraction/prompts";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import { SCHEMA_VERSION } from "../../src/core/schema/privacy-facts.schema";
import { MODEL } from "../../src/lib/anthropic";
import { CANONICAL_POLICY_IDS, loadGoldExtraction, loadPolicyText } from "../../evals/lib/dataset";
import { diffWatchedPaths, WATCHED_EXTRACTION_PATHS } from "../../evals/lib/extraction-diff";
import { buildRunManifest, ensureResultsDir, rubricVersionFromYaml } from "../../evals/lib/manifest";
import { mean, percentile, sortedCopy } from "../../evals/lib/percentiles";
import { writeEvalArtifacts, type EvalReportInput, type PerPolicyBlock } from "../../evals/lib/report";
import type { PrivacyFacts } from "../../src/core/schema/types";

const repoRoot = join(__dirname, "../..");
const rubricPath = join(repoRoot, "src/core/scoring/rubric.v2.yaml");

function watchedAgreementFraction(a: PrivacyFacts, b: PrivacyFacts): number {
  const diffs = diffWatchedPaths(a, b);
  return 1 - diffs.length / WATCHED_EXTRACTION_PATHS.length;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const verbose = process.argv.includes("--verbose");
  const rubric = loadRubricOrThrow(rubricPath);
  const rubricVersion = rubricVersionFromYaml(rubricPath);
  const promptA = buildSystemPrompt();
  const promptB = buildSystemPromptEvalVariantB();
  const outDir = ensureResultsDir(repoRoot);

  const manifest = buildRunManifest({
    schemaVersion: SCHEMA_VERSION,
    rubricVersion,
    modelId: MODEL,
    systemPrompt: `${promptA}\n---VS---\n${promptB}`,
    datasetPolicyIds: [...CANONICAL_POLICY_IDS],
  });

  const perPolicy: PerPolicyBlock[] = [];
  const failuresAppendix: string[] = [];
  const summaryRows: string[] = [];
  summaryRows.push("## A/B summary");
  summaryRows.push("");
  summaryRows.push("| Policy | Grade A | Grade B | Watched-field agreement | Changed paths |");
  summaryRows.push("|--------|---------|---------|-------------------------|---------------|");

  let gradeMatches = 0;
  const agreementFracs: number[] = [];
  const tokenAs: number[] = [];
  const tokenBs: number[] = [];
  const latencyAs: number[] = [];
  const latencyBs: number[] = [];

  for (const id of CANONICAL_POLICY_IDS) {
    const gold = loadGoldExtraction(repoRoot, id);
    const text = loadPolicyText(repoRoot, id);
    const url = gold.metadata.policyUrl;
    const company = gold.metadata.companyName;

    if (verbose) {
      // eslint-disable-next-line no-console
      console.error(`${id}: baseline extract…`);
    }
    const exA = await extract(text, company, url, { systemPromptOverride: promptA });
    if (verbose) {
      // eslint-disable-next-line no-console
      console.error(`${id}: variant extract…`);
    }
    const exB = await extract(text, company, url, { systemPromptOverride: promptB });

    if (!exA.success || !exB.success) {
      if (!exA.success) failuresAppendix.push(`**${id}** baseline: ${exA.error}`);
      if (!exB.success) failuresAppendix.push(`**${id}** variant B: ${exB.error}`);
      perPolicy.push({
        id,
        title: `${company} (${id})`,
        pass: false,
        bullets: ["One or both extractions failed."],
        mismatches: [],
      });
      summaryRows.push(`| ${id} | — | — | — | (failure) |`);
      continue;
    }

    const gA = score(exA.data, rubric);
    const gB = score(exB.data, rubric);
    if (gA.letter === gB.letter) gradeMatches++;
    const diffs = diffWatchedPaths(exA.data, exB.data);
    const agreeFrac = watchedAgreementFraction(exA.data, exB.data);
    agreementFracs.push(agreeFrac);

    tokenAs.push(exA.meta.inputTokens + exA.meta.outputTokens);
    tokenBs.push(exB.meta.inputTokens + exB.meta.outputTokens);
    latencyAs.push(exA.meta.latencyMs);
    latencyBs.push(exB.meta.latencyMs);

    const changed = diffs.map((d) => d.path).join(", ") || "(none)";

    summaryRows.push(
      `| ${id} | ${gA.letter} (${gA.score}) | ${gB.letter} (${gB.score}) | ${(agreeFrac * 100).toFixed(0)}% | ${changed} |`
    );

    perPolicy.push({
      id,
      title: `${company} (${id})`,
      pass: true,
      gradeLetter: `${gA.letter} vs ${gB.letter}`,
      score: gA.score,
      bullets: [
        `Baseline grade **${gA.letter}** (${gA.score}); variant B **${gB.letter}** (${gB.score}).`,
        `Watched-path agreement fraction **${(agreeFrac * 100).toFixed(0)}%**.`,
      ],
      mismatches: diffs,
    });
  }

  const n = CANONICAL_POLICY_IDS.length;
  const gradeAgreementPct = (gradeMatches / n) * 100;
  const meanAgree = agreementFracs.length ? mean(agreementFracs) * 100 : 0;
  const allTokens = [...tokenAs, ...tokenBs];
  const allLat = [...latencyAs, ...latencyBs];

  summaryRows.push("");
  summaryRows.push(
    `**Aggregate:** grade match ${gradeMatches}/${n} (${gradeAgreementPct.toFixed(0)}%); mean watched-path agreement ${meanAgree.toFixed(0)}%.`
  );
  summaryRows.push("");
  summaryRows.push("## Cost / latency");
  summaryRows.push("");
  summaryRows.push("| Arm | Tokens p50 / p95 (in+out) | Latency p50 / p95 (ms) |");
  summaryRows.push("|-----|-----------------------------|-------------------------|");
  summaryRows.push(
    `| A (baseline) | ${percentile(sortedCopy(tokenAs), 50)} / ${percentile(sortedCopy(tokenAs), 95)} | ${percentile(sortedCopy(latencyAs), 50)} / ${percentile(sortedCopy(latencyAs), 95)} |`
  );
  summaryRows.push(
    `| B (eval variant) | ${percentile(sortedCopy(tokenBs), 50)} / ${percentile(sortedCopy(tokenBs), 95)} | ${percentile(sortedCopy(latencyBs), 50)} / ${percentile(sortedCopy(latencyBs), 95)} |`
  );
  summaryRows.push(
    `| Combined | ${percentile(sortedCopy(allTokens), 50)} / ${percentile(sortedCopy(allTokens), 95)} | ${percentile(sortedCopy(allLat), 50)} / ${percentile(sortedCopy(allLat), 95)} |`
  );

  const completionPass = failuresAppendix.length === 0;
  const overallPass = completionPass;

  const report: EvalReportInput = {
    overallPass,
    title: "Prompt A/B evaluation (baseline vs eval variant B)",
    headerLines: {
      Result: overallPass ? "PASS" : "FAIL",
      "Output directory": outDir,
      Rubric: `v${rubricVersion}`,
      Model: MODEL,
      Policies: String(n),
    },
    executiveBullets: [
      "Compared two system prompts on the same canonical policy texts (paired live calls).",
      `Grade agreement across policies: **${gradeAgreementPct.toFixed(0)}%**.`,
      `Mean watched-field agreement between paired runs: **${meanAgree.toFixed(0)}%**.`,
    ],
    gates: [
      {
        name: "All paired extractions succeeded",
        threshold: `${n} policies × 2 prompts`,
        observed: completionPass ? "complete" : "see appendix",
        pass: completionPass,
      },
    ],
    perPolicy,
    consistencyMarkdown: summaryRows.join("\n"),
    failuresAppendix,
  };

  const metrics = {
    overallPass,
    gradeAgreementPct,
    meanWatchedPathAgreementPct: meanAgree,
    tokens: { p50: percentile(sortedCopy(allTokens), 50), p95: percentile(sortedCopy(allTokens), 95) },
  };

  const paths = writeEvalArtifacts(outDir, report, metrics, manifest);
  // eslint-disable-next-line no-console
  console.log(
    overallPass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m",
    "— prompt A/B.",
    `Report: ${paths.reportPath}`
  );
  if (!overallPass) process.exitCode = 1;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
