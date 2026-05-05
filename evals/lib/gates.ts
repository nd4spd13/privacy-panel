/** Default thresholds for evaluation gates (aligned with eval plan). */

export const GATE_SCHEMA_VALIDITY_PCT = 100;

export const GATE_MOCK_FIELD_AGREEMENT_PCT = 100;

/** Live bench: max fraction of run pairs that may disagree on letter grade per policy. */
export const GATE_LIVE_GRADE_VOLATILITY_MAX = 0.05;

/** Live bench: max fraction of runs that used repair path (approximated via meta.retried). */
export const GATE_LIVE_REPAIR_RATE_MAX = 0.02;

/** Expected v2 rubric outcomes for canonical fixtures (see tests/core/scoring.test.ts). */
export const EXPECTED_V2_SCORES: Record<string, { score: number; letter: string }> = {
  minimal: { score: 100, letter: "A" },
  "typical-saas": { score: 78, letter: "B" },
  aggressive: { score: 0, letter: "F" },
};
