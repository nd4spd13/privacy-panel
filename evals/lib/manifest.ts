import { createHash } from "crypto";
import { execSync } from "child_process";
import { mkdirSync, readFileSync } from "fs";
import { join } from "path";

export interface RunManifest {
  timestamp: string;
  gitSha: string;
  gitShortSha: string;
  schemaVersion: string;
  rubricVersion: string;
  modelId: string;
  promptSha256Prefix: string;
  datasetPolicyIds: string[];
  nodeVersion: string;
}

export function getGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

export function getGitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

export function sha256Prefix(text: string, hexChars = 12): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, hexChars);
}

export function buildRunManifest(input: {
  schemaVersion: string;
  rubricVersion: string;
  modelId: string;
  systemPrompt: string;
  datasetPolicyIds: string[];
}): RunManifest {
  return {
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    gitShortSha: getGitShortSha(),
    schemaVersion: input.schemaVersion,
    rubricVersion: input.rubricVersion,
    modelId: input.modelId,
    promptSha256Prefix: sha256Prefix(input.systemPrompt),
    datasetPolicyIds: input.datasetPolicyIds,
    nodeVersion: process.version,
  };
}

export function rubricVersionFromYaml(rubricPath: string): string {
  const raw = readFileSync(rubricPath, "utf-8");
  const m = raw.match(/^\s*version:\s*["']?(\d+)["']?\s*$/m);
  return m?.[1] ?? "unknown";
}

export function resultsDirName(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${ts}-${getGitShortSha()}`;
}

export function ensureResultsDir(repoRoot: string): string {
  const dir = join(repoRoot, "evals", "results", resultsDirName());
  mkdirSync(dir, { recursive: true });
  return dir;
}
