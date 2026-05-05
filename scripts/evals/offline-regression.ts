#!/usr/bin/env tsx
/**
 * Offline regression: canonical fixtures + mocked Claude responses (gold JSON).
 * Writes human-readable eval-report.md and metrics under evals/results/.
 *
 * Usage: pnpm eval:offline
 */
require("../../cli/server-only-shim.cjs");

import { join } from "path";
import { extract } from "../../src/core/extraction/extractor";
import { buildSystemPrompt } from "../../src/core/extraction/prompts";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import { validate } from "../../src/core/schema/privacy-panel.schema";
import { SCHEMA_VERSION } from "../../src/core/schema/privacy-panel.schema";
import { MODEL } from "../../src/lib/anthropic";
import {
  CANONICAL_POLICY_IDS,
  loadGoldExtraction,
  loadPolicyText,
} from "../../evals/lib/dataset";
import { diffWatchedPaths, extractionJsonEquals } from "../../evals/lib/extraction-diff";
import {
  EXPECTED_V2_SCORES,
  GATE_MOCK_FIELD_AGREEMENT_PCT,
  GATE_SCHEMA_VALIDITY_PCT,
} from "../../evals/lib/gates";
import { buildRunManifest, ensureResultsDir, rubricVersionFromYaml } from "../../evals/lib/manifest";
import { makeAnthropicFixtureClient } from "../../evals/lib/mock-client";
import { writeEvalArtifacts, type EvalReportInput, type PerPolicyBlock } from "../../evals/lib/report";

const repoRoot = join(__dirname, "../..");
const rubricPath = join(repoRoot, "src/core/scoring/rubric.v2.yaml");

async function main(): Promise<void> {
  const rubric = loadRubricOrThrow(rubricPath);
  const rubricVersion = rubricVersionFromYaml(rubricPath);
  const systemPrompt = buildSystemPrompt();
  const outDir = ensureResultsDir(repoRoot);

  let schemaOk = 0;
  let mockMatchAll = true;
  let gradeMatchAll = true;
  const perPolicy: PerPolicyBlock[] = [];
  const failuresAppendix: string[] = [];
  const metricsPolicies: Record<string, unknown> = {};

  for (const id of CANONICAL_POLICY_IDS) {
    const gold = loadGoldExtraction(repoRoot, id);
    const policyText = loadPolicyText(repoRoot, id);
    const company = gold.metadata.companyName;

    const goldValid = validate(gold);
    const goldSchemaPass = goldValid.success;
    if (goldSchemaPass) schemaOk++;

    const expected = EXPECTED_V2_SCORES[id];
    const goldGrade = score(gold, rubric);
    const gradePass =
      goldGrade.score === expected.score && goldGrade.letter === expected.letter;

    const client = makeAnthropicFixtureClient(gold);
    const ex = await extract(policyText, company, gold.metadata.policyUrl, {
      anthropicClient: client,
    });

    let mismatches: ReturnType<typeof diffWatchedPaths> = [];
    if (!ex.success) {
      failuresAppendix.push(`**${id}** — extraction failed: ${ex.error}`);
      mockMatchAll = false;
    } else {
      const jsonOk = extractionJsonEquals(gold, ex.data);
      mismatches = diffWatchedPaths(gold, ex.data);
      if (!jsonOk || mismatches.length > 0) {
        mockMatchAll = false;
        failuresAppendix.push(
          `**${id}** — normalized JSON equals gold: ${jsonOk ? "yes" : "no"}; watched-field mismatches: ${mismatches.length}`
        );
      }
      metricsPolicies[id] = {
        schemaValid: goldSchemaPass,
        mockJsonEquals: jsonOk,
        watchedMismatches: mismatches.length,
        gradeLetter: goldGrade.letter,
        gradeScore: goldGrade.score,
        gradeExpected: expected,
        gradePass,
      };
    }

    if (!gradePass) gradeMatchAll = false;

    const jsonOk = ex.success && extractionJsonEquals(gold, ex.data);
    perPolicy.push({
      id,
      title: `${company} (${id})`,
      pass: Boolean(goldSchemaPass && ex.success && jsonOk && gradePass),
      gradeLetter: goldGrade.letter,
      score: goldGrade.score,
      bullets: [
        goldSchemaPass ? "Gold fixture passes schema validation." : "Gold fixture fails schema validation.",
        ex.success ? "Mocked extract() succeeded." : "Mocked extract() failed.",
        `Grade vs v2 rubric: ${goldGrade.letter} (${goldGrade.score}), expected ${expected.letter} (${expected.score}).`,
      ],
      mismatches: ex.success ? mismatches : [],
    });
  }

  const schemaPct = (schemaOk / CANONICAL_POLICY_IDS.length) * 100;
  const mockAgreePct = mockMatchAll ? 100 : 0;
  const gradePct = gradeMatchAll ? 100 : 0;

  const gates = [
    {
      name: "Schema validity (gold fixtures)",
      threshold: `${GATE_SCHEMA_VALIDITY_PCT}%`,
      observed: `${schemaPct.toFixed(0)}%`,
      pass: schemaPct >= GATE_SCHEMA_VALIDITY_PCT,
    },
    {
      name: "Mocked extract matches gold (normalized JSON + watched paths)",
      threshold: `${GATE_MOCK_FIELD_AGREEMENT_PCT}%`,
      observed: `${mockAgreePct.toFixed(0)}%`,
      pass: mockAgreePct >= GATE_MOCK_FIELD_AGREEMENT_PCT && mockMatchAll,
    },
    {
      name: "Fixture letter grades (v2)",
      threshold: "100% match to expected A/B/F",
      observed: `${gradePct.toFixed(0)}%`,
      pass: gradeMatchAll,
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
    title: "Offline extraction and grading regression",
    headerLines: {
      Result: overallPass ? "PASS" : "FAIL",
      "Output directory": outDir,
      Rubric: `${rubricPath} (version ${rubricVersion})`,
      Model: MODEL,
      "Dataset policies": CANONICAL_POLICY_IDS.join(", "),
    },
    executiveBullets: [
      `Evaluated ${CANONICAL_POLICY_IDS.length} canonical policies with mocked Claude returning gold JSON.`,
      overallPass
        ? "All gates passed: schema, mocked extraction parity, and expected v2 grades."
        : "One or more gates failed — see per-policy results and failures appendix.",
      `Artifacts: eval-report.md, metrics.json, run-manifest.json`,
    ],
    gates,
    perPolicy,
    failuresAppendix,
  };

  const metrics = {
    overallPass,
    gates,
    policies: metricsPolicies,
  };

  const paths = writeEvalArtifacts(outDir, report, metrics, manifest);

  // eslint-disable-next-line no-console
  console.log(
    overallPass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m",
    "— offline regression.",
    `Report: ${paths.reportPath}`
  );

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
