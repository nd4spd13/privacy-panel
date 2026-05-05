#!/usr/bin/env tsx
/**
 * Live consistency: repeated real Claude extractions per canonical fixture.
 * Requires ANTHROPIC_API_KEY. Writes eval-report.md under evals/results/.
 *
 * Usage: pnpm eval:live [--runs 10] [--verbose]
 */
require("../../cli/server-only-shim.cjs");

import { extract } from "../../src/core/extraction/extractor";
import { buildSystemPrompt } from "../../src/core/extraction/prompts";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import { SCHEMA_VERSION } from "../../src/core/schema/privacy-panel.schema";
import { MODEL } from "../../src/lib/anthropic";
import {
  CANONICAL_POLICY_IDS,
  loadGoldExtraction,
  loadPolicyText,
} from "../../evals/lib/dataset";
import {
  GATE_LIVE_GRADE_VOLATILITY_MAX,
  GATE_LIVE_REPAIR_RATE_MAX,
} from "../../evals/lib/gates";
import { getAtPath, WATCHED_EXTRACTION_PATHS, formatValue } from "../../evals/lib/extraction-diff";
import { buildRunManifest, ensureResultsDir, rubricVersionFromYaml } from "../../evals/lib/manifest";
import { mean, percentile, sortedCopy, stddev } from "../../evals/lib/percentiles";
import { writeEvalArtifacts, type EvalReportInput, type PerPolicyBlock } from "../../evals/lib/report";
import type { PrivacyPanel } from "../../src/core/schema/types";
import { join } from "path";

const repoRoot = join(__dirname, "../..");
const rubricPath = join(repoRoot, "src/core/scoring/rubric.v2.yaml");

function parseRuns(): number {
  const i = process.argv.indexOf("--runs");
  if (i === -1 || !process.argv[i + 1]) return 10;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) && n >= 1 ? n : 10;
}

function modeLetter(letters: string[]): string {
  const counts = new Map<string, number>();
  for (const L of letters) counts.set(L, (counts.get(L) ?? 0) + 1);
  let best = letters[0] ?? "?";
  let bestC = -1;
  for (const [L, c] of counts) {
    if (c > bestC) {
      bestC = c;
      best = L;
    }
  }
  return best;
}

function gradeVolatilityRate(letters: string[]): number {
  if (letters.length < 2) return 0;
  const m = modeLetter(letters);
  const disagree = letters.filter((L) => L !== m).length;
  return disagree / letters.length;
}

function fieldAgreementRate(runs: PrivacyPanel[], path: string): number {
  if (runs.length === 0) return 0;
  const vals = runs.map((r) => formatValue(getAtPath(r, path)));
  const mode = (() => {
    const counts = new Map<string, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = vals[0];
    let bestC = -1;
    for (const [v, c] of counts) {
      if (c > bestC) {
        bestC = c;
        best = v;
      }
    }
    return best;
  })();
  const agree = vals.filter((v) => v === mode).length;
  return agree / vals.length;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.error("ANTHROPIC_API_KEY is not set. Skipping live eval is not supported — exiting.");
    process.exit(1);
  }

  const runs = parseRuns();
  const verbose = process.argv.includes("--verbose");
  const rubric = loadRubricOrThrow(rubricPath);
  const rubricVersion = rubricVersionFromYaml(rubricPath);
  const systemPrompt = buildSystemPrompt();
  const outDir = ensureResultsDir(repoRoot);

  const allLetters: string[] = [];
  const allRetried: boolean[] = [];
  const allLatencies: number[] = [];
  const perPolicyBlocks: PerPolicyBlock[] = [];
  const consistencyRows: string[] = [];
  const failuresAppendix: string[] = [];

  for (const id of CANONICAL_POLICY_IDS) {
    const gold = loadGoldExtraction(repoRoot, id);
    const text = loadPolicyText(repoRoot, id);
    const url = gold.metadata.policyUrl;
    const company = gold.metadata.companyName;

    const runExtractions: PrivacyPanel[] = [];
    const letters: string[] = [];
    const scores: number[] = [];
    const policyLatencies: number[] = [];
    const policyRetried: boolean[] = [];

    for (let i = 0; i < runs; i++) {
      if (verbose) {
        // eslint-disable-next-line no-console
        console.error(`${id} run ${i + 1}/${runs} …`);
      }
      const ex = await extract(text, company, url);
      if (!ex.success) {
        failuresAppendix.push(`**${id}** run ${i + 1}: ${ex.error}`);
        continue;
      }
      runExtractions.push(ex.data);
      const g = score(ex.data, rubric);
      letters.push(g.letter);
      scores.push(g.score);
      allLetters.push(g.letter);
      allRetried.push(ex.meta.retried);
      policyRetried.push(ex.meta.retried);
      policyLatencies.push(ex.meta.latencyMs);
      allLatencies.push(ex.meta.latencyMs);
    }

    const vol = gradeVolatilityRate(letters);
    const repairRate =
      policyRetried.length > 0 ? policyRetried.filter(Boolean).length / policyRetried.length : 0;

    const fieldRates = WATCHED_EXTRACTION_PATHS.map((path) => ({
      path,
      rate: runExtractions.length ? fieldAgreementRate(runExtractions, path) : 0,
    }));

    consistencyRows.push(`### ${id} — ${company}`);
    consistencyRows.push("");
    consistencyRows.push("| Metric | Value |");
    consistencyRows.push("|--------|-------|");
    consistencyRows.push(`| Successful runs | ${letters.length} / ${runs} |`);
    consistencyRows.push(`| Grade mode | ${modeLetter(letters)} |`);
    consistencyRows.push(`| Grade volatility (non-mode / N) | ${(vol * 100).toFixed(1)}% |`);
    consistencyRows.push(`| Score mean (successful) | ${mean(scores).toFixed(1)} |`);
    consistencyRows.push(`| Score stdev | ${stddev(scores).toFixed(2)} |`);
    consistencyRows.push(
      `| Latency p50 / p95 (ms) | ${percentile(sortedCopy(policyLatencies), 50)} / ${percentile(sortedCopy(policyLatencies), 95)} |`
    );
    consistencyRows.push(`| Repair flag rate (this policy) | ${(repairRate * 100).toFixed(1)}% |`);
    consistencyRows.push("");
    consistencyRows.push("| Watched path | Agreement with mode |");
    consistencyRows.push("|--------------|---------------------|");
    for (const fr of fieldRates) {
      consistencyRows.push(`| \`${fr.path}\` | ${(fr.rate * 100).toFixed(0)}% |`);
    }
    consistencyRows.push("");

    const policyPass =
      letters.length === runs &&
      vol <= GATE_LIVE_GRADE_VOLATILITY_MAX &&
      repairRate <= GATE_LIVE_REPAIR_RATE_MAX;

    perPolicyBlocks.push({
      id,
      title: `${company} (${id})`,
      pass: policyPass,
      gradeLetter: modeLetter(letters),
      score: mean(scores),
      bullets: [
        `${letters.length} successful live runs (requested ${runs}).`,
        `Grade volatility ${(vol * 100).toFixed(1)}% (gate ≤ ${(GATE_LIVE_GRADE_VOLATILITY_MAX * 100).toFixed(0)}%).`,
        `Repair rate ${(repairRate * 100).toFixed(1)}% (gate ≤ ${(GATE_LIVE_REPAIR_RATE_MAX * 100).toFixed(0)}%).`,
      ],
      mismatches: [],
    });
  }

  const globalRepairRate =
    allRetried.length > 0 ? allRetried.filter(Boolean).length / allRetried.length : 0;
  const globalVol =
    allLetters.length > 0
      ? allLetters.filter((L) => L !== modeLetter(allLetters)).length / allLetters.length
      : 0;

  const completionPass = perPolicyBlocks.every((p) => {
    const m = p.bullets[0]?.match(/^(\d+) successful/);
    return m != null && parseInt(m[1], 10) === runs;
  });

  const perPolicyGatePass = perPolicyBlocks.every((p) => p.pass);

  const gates = [
    {
      name: "All policies completed requested runs",
      threshold: `${runs} runs × ${CANONICAL_POLICY_IDS.length} policies`,
      observed: completionPass ? "complete" : "incomplete (see appendix)",
      pass: completionPass,
    },
    {
      name: "Per-policy gates (grade volatility + repair rate)",
      threshold: `letter volatility ≤ ${(GATE_LIVE_GRADE_VOLATILITY_MAX * 100).toFixed(0)}%; repair ≤ ${(GATE_LIVE_REPAIR_RATE_MAX * 100).toFixed(0)}% each policy`,
      observed: `all policies pass: ${perPolicyGatePass ? "yes" : "no"}; global non-mode ${(globalVol * 100).toFixed(1)}%; global repair ${(globalRepairRate * 100).toFixed(1)}%`,
      pass: perPolicyGatePass,
    },
  ];

  const overallPass = gates.every((g) => g.pass);

  const manifest = buildRunManifest({
    schemaVersion: SCHEMA_VERSION,
    rubricVersion,
    modelId: MODEL,
    systemPrompt,
    datasetPolicyIds: [...CANONICAL_POLICY_IDS],
  });

  const report: EvalReportInput = {
    overallPass,
    title: "Live extraction consistency bench",
    headerLines: {
      Result: overallPass ? "PASS" : "FAIL",
      "Output directory": outDir,
      Rubric: `v${rubricVersion}`,
      Model: MODEL,
      Runs: String(runs),
    },
    executiveBullets: [
      `Live Claude extractions (${runs} each) on ${CANONICAL_POLICY_IDS.length} canonical policies.`,
      `Global repair-flag rate ${(globalRepairRate * 100).toFixed(1)}% across ${allRetried.length} runs.`,
      failuresAppendix.length
        ? `${failuresAppendix.length} run-level failures — see appendix.`
        : "No run-level extraction failures.",
    ],
    gates,
    perPolicy: perPolicyBlocks,
    consistencyMarkdown: consistencyRows.join("\n"),
    failuresAppendix,
  };

  const metrics = {
    overallPass,
    runsPerPolicy: runs,
    globalRepairRate,
    globalGradeVolatility: globalVol,
    gates,
    latencyMs: {
      p50: percentile(sortedCopy(allLatencies), 50),
      p95: percentile(sortedCopy(allLatencies), 95),
    },
  };

  const paths = writeEvalArtifacts(outDir, report, metrics, manifest);
  // eslint-disable-next-line no-console
  console.log(
    overallPass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m",
    "— live consistency.",
    `Report: ${paths.reportPath}`
  );

  if (!overallPass) process.exitCode = 1;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
