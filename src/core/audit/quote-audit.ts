/**
 * Quote-integrity audit (CRS-187).
 *
 * Verifies that every `sourceQuote` stored in an extraction is one of:
 *   - VERBATIM:     present in the policy text — either an exact (normalized) substring
 *                   or a high word-trigram-coverage match (handles light reformatting
 *                   such as parentheticals, joins, and truncation).
 *   - SILENCE:      a "policy is silent" note that should collapse to one canonical boilerplate.
 *   - BOILERPLATE:  already exactly the canonical boilerplate.
 *   - FLAGGED:      AI commentary / hallucinated / paraphrased text that cannot be located
 *                   in the policy. Never auto-fixed — must be re-extracted (CRS-174).
 *   - UNVERIFIABLE: no raw policy text on file for the company, so the quote can't be checked.
 *
 * Pure module: no DB, no fs. Unit-testable and reusable by the eval suite (CRS-82)
 * as a pre-publish gate, and by the CLI runner at scripts/audit-quotes.ts.
 *
 * The normalizer here is intentionally local. It should converge with the canonical
 * `norm-v1` normalizer once CRS-94 lands, at which point this file should import it.
 */

/** The single canonical string used everywhere a policy is silent on a field. */
export const POLICY_SILENT_BOILERPLATE = "Not addressed in this policy.";

/**
 * Minimum word-trigram coverage for a non-exact quote to count as located in the policy.
 * Real excerpts that were lightly reformatted score high; fabricated/paraphrased quotes score low.
 */
export const MATCH_THRESHOLD = 0.6;

/** Markers that a quote was fabricated or is a placeholder rather than excerpted. Always FLAGGED. */
const HALLUCINATION_PATTERNS: readonly RegExp[] = [
  /based on training knowledge/i,
  /migrated from v1/i,
  /verify against live policy/i,
  /requires re-extraction/i,
  /\bas an ai\b/i,
];

/** Phrases that signal the policy is silent (AI commentary, not an excerpt). */
const SILENCE_PATTERNS: readonly RegExp[] = [
  /does not(?:\s+\w+){0,3}\s+(?:mention|address|specify|state|disclose)/i,
  /no (?:explicit )?mention/i,
  /policy is silent/i,
  /silent on this/i,
  /not (?:stated|specified|addressed|mentioned|disclosed)/i,
  /no information (?:provided|available)/i,
];

export type QuoteStatus =
  | "verbatim"
  | "silence"
  | "boilerplate"
  | "flagged"
  | "unverifiable";

export interface QuoteFinding {
  /** Dotted JSON path, e.g. "dataSharing.soldToThirdParties.sourceQuote". */
  path: string;
  quote: string;
  /** Sibling `value` of the containing object, when present (BooleanPractice etc.). */
  value: boolean | string | null;
  status: QuoteStatus;
  /** Fraction of the quote's phrasing found in the policy (0–1), when a text check ran. */
  coverage?: number;
  /** Why it landed in this status (hallucination marker, not located, …). */
  reason?: string;
}

/**
 * Light normalization for matching: NFC, lowercase, unify curly quotes and dashes,
 * collapse whitespace. Deliberately conservative — it does not strip punctuation.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'") // curly / prime single quotes → '
    .replace(/[“”‟″]/g, '"') // curly double quotes → "
    .replace(/[‐-―−]/g, "-") // hyphens / dashes / minus → -
    .replace(/\s+/g, " ")
    .trim();
}

function wordTrigrams(s: string): string[] {
  const words = s.split(" ").filter(Boolean);
  if (words.length < 3) return words.length ? [words.join(" ")] : [];
  const grams: string[] = [];
  for (let i = 0; i + 3 <= words.length; i++) grams.push(words.slice(i, i + 3).join(" "));
  return grams;
}

/**
 * Fraction of the quote's word-trigrams that appear in the policy. A cheap fuzzy-containment
 * proxy: tolerant of light reformatting, but near-zero for fabricated or paraphrased text.
 * Inputs must already be normalized via {@link normalizeForMatch}.
 */
export function coverage(quoteNorm: string, policyNorm: string): number {
  const grams = wordTrigrams(quoteNorm);
  if (grams.length === 0) return 0;
  let hit = 0;
  for (const g of grams) if (policyNorm.includes(g)) hit++;
  return hit / grams.length;
}

interface RawQuote {
  path: string;
  quote: string;
  value: boolean | string | null;
}

/**
 * Recursively collect every `sourceQuote` string (with its sibling `value`, if any)
 * from a facts object. Schema-agnostic, so it survives schema changes and handles
 * both v1 and v2 extractions.
 */
export function collectQuotes(node: unknown, path: string[] = []): RawQuote[] {
  const out: RawQuote[] = [];
  if (node === null || typeof node !== "object") return out;

  if (Array.isArray(node)) {
    node.forEach((item, i) => out.push(...collectQuotes(item, [...path, String(i)])));
    return out;
  }

  const obj = node as Record<string, unknown>;
  if (typeof obj.sourceQuote === "string") {
    const v = obj.value;
    out.push({
      path: [...path, "sourceQuote"].join("."),
      quote: obj.sourceQuote,
      value: typeof v === "boolean" || typeof v === "string" ? v : null,
    });
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "sourceQuote") continue;
    if (val !== null && typeof val === "object") {
      out.push(...collectQuotes(val, [...path, key]));
    }
  }
  return out;
}

function pct(n: number): number {
  return Math.round(n * 100);
}

function classify(
  quote: string,
  normalizedPolicy: string | null
): { status: QuoteStatus; reason?: string; coverage?: number } {
  const trimmed = quote.trim();

  if (trimmed === POLICY_SILENT_BOILERPLATE) return { status: "boilerplate" };

  for (const re of HALLUCINATION_PATTERNS) {
    if (re.test(quote)) return { status: "flagged", reason: `hallucination marker: /${re.source}/` };
  }

  if (trimmed === "") return { status: "silence", reason: "empty quote" };

  if (normalizedPolicy === null) {
    return { status: "unverifiable", reason: "no raw policy text on file" };
  }

  const needle = normalizeForMatch(quote);
  if (needle.length > 0 && normalizedPolicy.includes(needle)) {
    return { status: "verbatim", coverage: 1 };
  }

  // Silence commentary is checked before fuzzy matching so its incidental word overlap
  // with the policy doesn't get mistaken for a real excerpt.
  for (const re of SILENCE_PATTERNS) {
    if (re.test(quote)) return { status: "silence", reason: "policy-silent note" };
  }

  const cov = coverage(needle, normalizedPolicy);
  if (cov >= MATCH_THRESHOLD) {
    return { status: "verbatim", coverage: cov, reason: `fuzzy match (${pct(cov)}% of phrasing found)` };
  }

  return { status: "flagged", coverage: cov, reason: `not located (${pct(cov)}% of phrasing found)` };
}

export interface FactsAuditResult {
  findings: QuoteFinding[];
  counts: Record<QuoteStatus, number>;
}

/** Audit every sourceQuote in a facts object against its policy text. */
export function auditFacts(facts: unknown, policyText: string | null): FactsAuditResult {
  const normalizedPolicy = policyText === null ? null : normalizeForMatch(policyText);
  const findings: QuoteFinding[] = collectQuotes(facts).map(({ path, quote, value }) => {
    const { status, reason, coverage: cov } = classify(quote, normalizedPolicy);
    return { path, quote, value, status, reason, coverage: cov };
  });

  const counts: Record<QuoteStatus, number> = {
    verbatim: 0,
    silence: 0,
    boilerplate: 0,
    flagged: 0,
    unverifiable: 0,
  };
  for (const f of findings) counts[f.status]++;

  return { findings, counts };
}

/**
 * Produce a corrected deep copy of `facts` where every SILENCE quote is replaced with the
 * canonical boilerplate. FLAGGED, VERBATIM, BOILERPLATE and UNVERIFIABLE quotes are left
 * untouched — FLAGGED quotes need re-extraction (CRS-174), not silent rewriting.
 */
export function normalizeSilenceQuotes(
  facts: unknown,
  policyText: string | null
): { facts: unknown; replaced: number } {
  const normalizedPolicy = policyText === null ? null : normalizeForMatch(policyText);
  let replaced = 0;

  function walk(node: unknown): unknown {
    if (node === null || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(walk);

    const obj = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) next[k] = walk(v);

    if (typeof obj.sourceQuote === "string") {
      const { status } = classify(obj.sourceQuote, normalizedPolicy);
      if (status === "silence") {
        next.sourceQuote = POLICY_SILENT_BOILERPLATE;
        replaced++;
      }
    }
    return next;
  }

  return { facts: walk(facts), replaced };
}
