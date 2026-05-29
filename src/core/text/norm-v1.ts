/**
 * norm-v1 — the canonical, versioned text normalizer for Privacy Panel.
 *
 * One normalizer, used everywhere policy text is compared or hashed:
 *   - quote-integrity audit (CRS-187)
 *   - sourceAnchor offsets + policyTextHash (CRS-175 schema, CRS-195 consumers)
 *   - change-detection content hashing (CRS-94)
 *
 * Offsets, anchors, and hashes are only meaningful against the *same* normalized
 * text. Treat the rules below as frozen: if they ever need to change, bump to a new
 * `norm-v2` module and re-derive — never silently alter norm-v1, or every stored
 * hash and offset breaks.
 */
import { createHash } from "crypto";

export const NORMALIZER_VERSION = "norm-v1";

/** Characters of context stored on each side of an anchored quote (W3C TextQuoteSelector). */
const ANCHOR_CONTEXT = 32;

/**
 * NFC, lowercase, unify curly quotes/dashes, collapse whitespace.
 * Deliberately conservative — it does not strip punctuation, to avoid false matches.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'") // curly / prime single quotes → '
    .replace(/[“”‟″]/g, '"') // curly double quotes → "
    .replace(/[‐-―−]/g, "-") // hyphens / dashes / minus → -
    .replace(/\s+/g, " ")
    .trim();
}

/** SHA-256 hex of the normalized text — the provenance / verification hash (norm-v1). */
export function normalizedHash(text: string): string {
  return createHash("sha256").update(normalize(text), "utf8").digest("hex");
}

function wordTrigrams(s: string): string[] {
  const words = s.split(" ").filter(Boolean);
  if (words.length < 3) return words.length ? [words.join(" ")] : [];
  const grams: string[] = [];
  for (let i = 0; i + 3 <= words.length; i++) grams.push(words.slice(i, i + 3).join(" "));
  return grams;
}

/**
 * Fraction of the quote's word-trigrams present in the policy. A cheap fuzzy-containment
 * proxy: tolerant of light reformatting, near-zero for fabricated/paraphrased text.
 * Both inputs must already be normalized via {@link normalize}.
 */
export function coverage(quoteNorm: string, policyNorm: string): number {
  const grams = wordTrigrams(quoteNorm);
  if (grams.length === 0) return 0;
  let hit = 0;
  for (const g of grams) if (policyNorm.includes(g)) hit++;
  return hit / grams.length;
}

export interface QuoteAnchor {
  /** Character offsets into the normalized policy text. */
  position: { start: number; end: number };
  /** ~32 chars before/after for content-based re-location if offsets drift. */
  prefix: string;
  suffix: string;
  /** The normalized quote actually located. */
  exact: string;
}

/**
 * Locate `quote` exactly within already-normalized policy text and return a
 * TextQuoteSelector + position. Returns null when the quote is not an exact
 * substring of the normalized text (i.e. it is not verbatim and cannot be anchored).
 *
 * `normalizedPolicy` MUST be the output of {@link normalize} on the policy text.
 */
export function locateQuote(quote: string, normalizedPolicy: string): QuoteAnchor | null {
  const exact = normalize(quote);
  if (!exact) return null;
  const start = normalizedPolicy.indexOf(exact);
  if (start === -1) return null;
  const end = start + exact.length;
  return {
    position: { start, end },
    prefix: normalizedPolicy.slice(Math.max(0, start - ANCHOR_CONTEXT), start),
    suffix: normalizedPolicy.slice(end, end + ANCHOR_CONTEXT),
    exact,
  };
}
