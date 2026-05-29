import { describe, it, expect } from "vitest";
import {
  NORMALIZER_VERSION,
  normalize,
  normalizedHash,
  coverage,
  locateQuote,
} from "@/core/text/norm-v1";

describe("normalize", () => {
  it("lowercases, collapses whitespace, unifies curly quotes/dashes", () => {
    expect(normalize("  We  Don’t   Sell—data ")).toBe("we don't sell-data");
  });
});

describe("normalizedHash", () => {
  it("is a 64-char sha256 hex, deterministic, and whitespace/case-insensitive", () => {
    expect(normalizedHash("a")).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizedHash("Hello   World")).toBe(normalizedHash("hello world"));
    expect(normalizedHash("a")).not.toBe(normalizedHash("b"));
  });
  it("pins the version string", () => {
    expect(NORMALIZER_VERSION).toBe("norm-v1");
  });
});

describe("coverage", () => {
  const policy = normalize("we collect your email address and device identifiers");
  it("is high for a contained/reformatted phrase, low for fabricated text", () => {
    expect(coverage(normalize("collect your email address"), policy)).toBeGreaterThanOrEqual(0.6);
    expect(coverage(normalize("we sell data to 47 named brokers"), policy)).toBeLessThan(0.3);
  });
});

describe("locateQuote", () => {
  const policy = normalize("We collect your email address and device identifiers.");

  it("returns position + prefix/suffix for an exact (normalized) match", () => {
    const a = locateQuote("Email Address", policy);
    expect(a).not.toBeNull();
    expect(policy.slice(a!.position.start, a!.position.end)).toBe("email address");
    expect(a!.exact).toBe("email address");
    expect(policy.startsWith(a!.prefix + "email address")).toBe(true);
    expect(policy.slice(a!.position.end).startsWith(a!.suffix)).toBe(true);
  });

  it("returns null when the quote is not a substring of the normalized text", () => {
    expect(locateQuote("we sell your data", policy)).toBeNull();
    expect(locateQuote("", policy)).toBeNull();
  });
});
