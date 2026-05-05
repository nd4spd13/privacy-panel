import type { PrivacyFacts } from "../../src/core/schema/types";

/** Watched paths for regression reporting (boolean practice `.value` or enum). */
export const WATCHED_EXTRACTION_PATHS: string[] = [
  "dataSharing.soldToThirdParties.value",
  "dataSharing.sharedForAdvertising.value",
  "dataSharing.crossSiteTracking.value",
  "dataSharing.usedForProfiling.value",
  "dataSharing.usedToTrainAI.value",
  "dataSharing.disclosedToLawEnforcement.value",
  "dataCollection.collectsPreciseGeolocation.value",
  "dataCollection.collectsBiometricData.value",
  "dataCollection.collectsHealthData.value",
  "dataCollection.collectsFinancialData.value",
  "signalHonoring.honorsBrowserPrivacySignals",
  "thirdPartyRecipients.categoryCount",
  "retention.longestStatedPeriod",
];

export function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function formatValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

export interface FieldMismatch {
  path: string;
  expected: string;
  actual: string;
  impact: string;
}

export function diffWatchedPaths(expected: PrivacyFacts, actual: PrivacyFacts): FieldMismatch[] {
  const out: FieldMismatch[] = [];
  for (const path of WATCHED_EXTRACTION_PATHS) {
    const e = getAtPath(expected, path);
    const a = getAtPath(actual, path);
    if (e !== a && !(Number.isNaN(e as number) && Number.isNaN(a as number))) {
      out.push({
        path,
        expected: formatValue(e),
        actual: formatValue(a),
        impact: impactLine(path),
      });
    }
  }
  return out;
}

function impactLine(path: string): string {
  if (path.startsWith("dataSharing.")) return "Affects v2 sharing and tracking deductions.";
  if (path.startsWith("dataCollection.collects")) return "Affects sensitive data collection deductions.";
  if (path.startsWith("signalHonoring")) return "Affects browser signal and bonus scoring.";
  if (path.startsWith("thirdPartyRecipients")) return "Affects third-party category tier deductions.";
  if (path.startsWith("retention")) return "Affects retention tier deductions.";
  return "May affect rubric deductions or bonuses.";
}

/** Strip volatile metadata for stable JSON comparison. */
export function normalizeForCompare(p: PrivacyFacts): PrivacyFacts {
  const c = structuredClone(p);
  c.metadata.analyzedAt = "";
  return c;
}

export function extractionJsonEquals(a: PrivacyFacts, b: PrivacyFacts): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}
