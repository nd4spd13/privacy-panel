import { readFileSync } from "fs";
import { join } from "path";
import { validate } from "../../src/core/schema/privacy-panel.schema";
import type { PrivacyPanel } from "../../src/core/schema/types";

export const CANONICAL_POLICY_IDS = ["minimal", "typical-saas", "aggressive"] as const;
export type CanonicalPolicyId = (typeof CANONICAL_POLICY_IDS)[number];

export function loadPolicyText(repoRoot: string, id: CanonicalPolicyId): string {
  return readFileSync(join(repoRoot, "tests/fixtures/policies", `${id}.txt`), "utf-8");
}

export function loadGoldExtraction(repoRoot: string, id: CanonicalPolicyId): PrivacyPanel {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "tests/fixtures/extractions", `${id}.json`), "utf-8")
  );
  const v = validate(raw);
  if (!v.success) throw new Error(`Invalid gold fixture ${id}: ${v.error.message}`);
  return v.data;
}
