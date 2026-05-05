import { writeFileSync } from "fs";
import { join } from "path";
import type { FieldMismatch } from "./extraction-diff";

export interface GateRow {
  name: string;
  threshold: string;
  observed: string;
  pass: boolean;
}

export interface PerPolicyBlock {
  id: string;
  title: string;
  pass: boolean;
  gradeLetter?: string;
  score?: number;
  bullets: string[];
  mismatches: FieldMismatch[];
}

export interface EvalReportInput {
  overallPass: boolean;
  title: string;
  headerLines: Record<string, string>;
  executiveBullets: string[];
  gates: GateRow[];
  perPolicy: PerPolicyBlock[];
  /** Extra markdown (e.g. live consistency tables). */
  consistencyMarkdown?: string;
  failuresAppendix: string[];
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderEvalMarkdown(input: EvalReportInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push("## Run header");
  lines.push("");
  lines.push("| Key | Value |");
  lines.push("|-----|-------|");
  for (const [k, v] of Object.entries(input.headerLines)) {
    lines.push(`| ${escCell(k)} | ${escCell(v)} |`);
  }
  lines.push("");
  lines.push(`**Overall:** ${input.overallPass ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push("## Executive summary");
  lines.push("");
  for (const b of input.executiveBullets) {
    lines.push(`- ${b}`);
  }
  lines.push("");
  lines.push("## Gates");
  lines.push("");
  lines.push("| Gate | Threshold | Observed | Pass |");
  lines.push("|------|-----------|----------|------|");
  for (const g of input.gates) {
    lines.push(
      `| ${escCell(g.name)} | ${escCell(g.threshold)} | ${escCell(g.observed)} | ${g.pass ? "yes" : "no"} |`
    );
  }
  lines.push("");
  lines.push("## Per-policy results");
  lines.push("");
  for (const p of input.perPolicy) {
    lines.push(`### ${p.id} — ${p.title}`);
    lines.push("");
    const g =
      p.gradeLetter !== undefined && p.score !== undefined
        ? `Grade **${p.gradeLetter}** (score ${p.score}). `
        : "";
    lines.push(`**Status:** ${p.pass ? "PASS" : "FAIL"}. ${g}`);
    lines.push("");
    if (p.bullets.length > 0) {
      for (const b of p.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
    if (p.mismatches.length === 0) {
      lines.push("- No watched-field mismatches.");
    } else {
      for (const m of p.mismatches) {
        lines.push(
          `- **${m.path}**: expected ${m.expected}, actual ${m.actual} — ${m.impact}`
        );
      }
    }
    lines.push("");
  }

  if (input.consistencyMarkdown) {
    lines.push("## Consistency (live bench)");
    lines.push("");
    lines.push(input.consistencyMarkdown);
    lines.push("");
  }

  lines.push("## Failures appendix");
  lines.push("");
  if (input.failuresAppendix.length === 0) {
    lines.push("_None._");
  } else {
    for (const f of input.failuresAppendix) {
      lines.push(f);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function writeEvalArtifacts(
  outDir: string,
  report: EvalReportInput,
  metrics: Record<string, unknown>,
  manifest: object
): { reportPath: string; metricsPath: string; manifestPath: string } {
  const md = renderEvalMarkdown(report);
  const reportPath = join(outDir, "eval-report.md");
  const metricsPath = join(outDir, "metrics.json");
  const manifestPath = join(outDir, "run-manifest.json");
  writeFileSync(reportPath, md, "utf-8");
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return { reportPath, metricsPath, manifestPath };
}
