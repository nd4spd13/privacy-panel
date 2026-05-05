# Privacy Panel — evaluation harness

This folder documents **canonical evaluation datasets** and how to run human-readable extraction and grading checks.

## Canonical dataset (fixtures)

All offline and most live/A/B runs use the same three policy texts and gold extractions maintained for unit tests:

| Policy id | Policy text | Gold extraction | Intended profile |
|-----------|--------------|------------------|------------------|
| `minimal` | [`tests/fixtures/policies/minimal.txt`](../tests/fixtures/policies/minimal.txt) | [`tests/fixtures/extractions/minimal.json`](../tests/fixtures/extractions/minimal.json) | Privacy-first / minimal collection |
| `typical-saas` | [`tests/fixtures/policies/typical-saas.txt`](../tests/fixtures/policies/typical-saas.txt) | [`tests/fixtures/extractions/typical-saas.json`](../tests/fixtures/extractions/typical-saas.json) | Common SaaS disclosures |
| `aggressive` | [`tests/fixtures/policies/aggressive.txt`](../tests/fixtures/policies/aggressive.txt) | [`tests/fixtures/extractions/aggressive.json`](../tests/fixtures/extractions/aggressive.json) | Aggressive collection and sharing |

**Rubric for scripted evals:** [`src/core/scoring/rubric.v2.yaml`](../src/core/scoring/rubric.v2.yaml) (same as [`tests/core/scoring.test.ts`](../tests/core/scoring.test.ts) expectations).

**Schema:** [`src/core/schema/privacy-panel.schema.ts`](../src/core/schema/privacy-panel.schema.ts) — `SCHEMA_VERSION` is stamped in manifests.

## Existing automated coverage (baseline)

- **Schema:** [`tests/core/schema.test.ts`](../tests/core/schema.test.ts)
- **Scoring (deterministic):** [`tests/core/scoring.test.ts`](../tests/core/scoring.test.ts) — fixture letter grades A / B / F for v2 rubric
- **Extraction (mocked API):** [`tests/core/extraction.test.ts`](../tests/core/extraction.test.ts) — validator, chunker, prompts, `extract()` with mocked Claude

The scripts under [`scripts/evals/`](../scripts/evals/) add **markdown + JSON artifacts** and optional **live** runs for variance measurement.

## Commands (from repo root)

| Script | Purpose | API key |
|--------|---------|---------|
| `pnpm eval:offline` | Mocked extraction + schema + grade gates; writes `evals/results/.../eval-report.md` | No |
| `pnpm eval:live` | Repeated live extractions per fixture; consistency tables | Yes (`ANTHROPIC_API_KEY`) |
| `pnpm eval:volatility` | Single-field perturbations vs v2 rubric; grade-flip map | No |
| `pnpm eval:ab` | Baseline vs eval prompt variant on fixtures | Yes |

Results directory pattern: `evals/results/<iso-timestamp>-<git-short-sha>/`.

## Gate thresholds (defaults)

Defined in code (`evals/lib/gates.ts`) to match the evaluation plan:

- Schema validity: 100%
- Gold fixture field agreement (mocked extract vs JSON): 100% on watched boolean paths
- Expected v2 grades: minimal → A (100), typical-saas → B (78), aggressive → F (0)
- Live grade volatility warning: more than 5% of pairwise run comparisons change letter (configurable)

## CI

Pull requests run `pnpm eval:ci` (`eval:offline`, `eval:volatility`, then Vitest). See [`.github/workflows/evals.yml`](../.github/workflows/evals.yml). Optional manual workflow can run live consistency with repository `ANTHROPIC_API_KEY` secret.
