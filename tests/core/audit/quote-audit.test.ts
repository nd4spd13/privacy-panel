import { describe, it, expect } from "vitest";
import {
  normalizeForMatch,
  collectQuotes,
  auditFacts,
  normalizeSilenceQuotes,
  POLICY_SILENT_BOILERPLATE,
} from "@/core/audit/quote-audit";

const POLICY = `
We collect your email address and device identifiers.
We do not sell your personal information to third parties.
We retain account data for 24 months after closure.
`;

describe("normalizeForMatch", () => {
  it("lowercases, collapses whitespace, and unifies curly quotes/dashes", () => {
    expect(normalizeForMatch("  We  Don’t   Sell—data ")).toBe("we don't sell-data");
  });
});

describe("collectQuotes", () => {
  it("finds every sourceQuote (nested + arrays) with its sibling value", () => {
    const facts = {
      dataSharing: { soldToThirdParties: { value: false, sourceQuote: "we do not sell" } },
      security: { additionalMeasures: [{ name: "SOC2", sourceQuote: "audited annually" }] },
      retention: { sourceQuote: "24 months" },
    };
    const quotes = collectQuotes(facts);
    expect(quotes).toEqual(
      expect.arrayContaining([
        { path: "dataSharing.soldToThirdParties.sourceQuote", quote: "we do not sell", value: false },
        { path: "security.additionalMeasures.0.sourceQuote", quote: "audited annually", value: null },
        { path: "retention.sourceQuote", quote: "24 months", value: null },
      ])
    );
    expect(quotes).toHaveLength(3);
  });
});

describe("auditFacts", () => {
  it("classifies verbatim, silence, hallucination, unlocated, and boilerplate", () => {
    const facts = {
      a: { value: false, sourceQuote: "We do not sell your personal information to third parties." }, // verbatim
      b: { value: null, sourceQuote: "The policy does not mention biometric data." }, // silence
      c: { value: true, sourceQuote: "Based on training knowledge — shares data with brokers." }, // flagged (hallucination)
      d: { value: true, sourceQuote: "Sells data to 47 named advertising partners." }, // flagged (not located)
      e: { value: null, sourceQuote: POLICY_SILENT_BOILERPLATE }, // boilerplate
    };
    const { counts, findings } = auditFacts(facts, POLICY);
    expect(counts).toMatchObject({ verbatim: 1, silence: 1, boilerplate: 1, flagged: 2, unverifiable: 0 });

    const byPath = Object.fromEntries(findings.map((f) => [f.path, f]));
    expect(byPath["c.sourceQuote"].reason).toMatch(/hallucination/);
    expect(byPath["d.sourceQuote"].reason).toMatch(/not located/);
  });

  it("accepts lightly-reformatted real excerpts as verbatim via fuzzy coverage", () => {
    const facts = {
      a: { value: true, sourceQuote: "collect your email address and device identifiers (for analytics)" },
    };
    const { counts, findings } = auditFacts(facts, POLICY);
    expect(counts.verbatim).toBe(1);
    expect(findings[0].coverage).toBeGreaterThanOrEqual(0.6);
  });

  it("marks quotes unverifiable when no policy text is on file", () => {
    const facts = { a: { value: true, sourceQuote: "anything at all" } };
    const { counts } = auditFacts(facts, null);
    expect(counts.unverifiable).toBe(1);
    expect(counts.flagged).toBe(0);
  });

  it("still flags hallucination markers even without policy text", () => {
    const facts = { a: { value: true, sourceQuote: "Migrated from v1 placeholder" } };
    expect(auditFacts(facts, null).counts.flagged).toBe(1);
  });
});

describe("normalizeSilenceQuotes", () => {
  it("rewrites only silence quotes, leaving verbatim and flagged untouched", () => {
    const facts = {
      a: { value: false, sourceQuote: "We do not sell your personal information to third parties." },
      b: { value: null, sourceQuote: "Policy is silent on this." },
      c: { value: true, sourceQuote: "Based on training knowledge — shares data." },
      d: { value: null, sourceQuote: "" },
    };
    const { facts: fixed, replaced } = normalizeSilenceQuotes(facts, POLICY) as {
      facts: typeof facts;
      replaced: number;
    };
    expect(replaced).toBe(2); // b (silence note) + d (empty)
    expect(fixed.a.sourceQuote).toMatch(/We do not sell/);
    expect(fixed.b.sourceQuote).toBe(POLICY_SILENT_BOILERPLATE);
    expect(fixed.c.sourceQuote).toMatch(/training knowledge/); // flagged: untouched
    expect(fixed.d.sourceQuote).toBe(POLICY_SILENT_BOILERPLATE);
  });

  it("does not rewrite when policy text is missing (can't confirm silence vs unverifiable)", () => {
    const facts = { a: { value: true, sourceQuote: "some specific claim" } };
    const { replaced } = normalizeSilenceQuotes(facts, null);
    expect(replaced).toBe(0);
  });
});
