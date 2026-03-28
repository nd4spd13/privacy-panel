import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import type { Rubric } from "../../src/core/scoring/rubric";
import { validate } from "../../src/core/schema/privacy-facts.schema";
import type { PrivacyFacts } from "../../src/core/schema/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(name: string): PrivacyFacts {
  const raw = JSON.parse(
    readFileSync(
      join(__dirname, "../fixtures/extractions", `${name}.json`),
      "utf-8"
    )
  );
  const result = validate(raw);
  if (!result.success) throw new Error(`Invalid fixture ${name}: ${result.error.message}`);
  return result.data;
}

let rubric: Rubric;

beforeAll(() => {
  rubric = loadRubricOrThrow(join(__dirname, "../../src/core/scoring/rubric.v1.yaml"));
});

// ─── Fixture grades ───────────────────────────────────────────────────────────

describe("score() — fixture profiles", () => {
  it("minimal (Signal-like) scores A (100)", () => {
    const result = score(loadFixture("minimal"), rubric);
    // No deductions; 4 rights (+8), 3 measures (+6) → 114 → clamped 100
    expect(result.score).toBe(100);
    expect(result.letter).toBe("A");
    expect(result.label).toBe("Excellent");
  });

  it("typical-saas scores B (70)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    // Deductions: advertising(-10) crossSite(-10) profiling(-8) financial(-3)
    //             GPC(-5) DNT(-2) 6-10 parties(-5) retention>1yr(-3) = -46
    // Bonuses: 5 rights(+10) 3 measures(+6) = +16
    // 100 - 46 + 16 = 70
    expect(result.score).toBe(70);
    expect(result.letter).toBe("B");
    expect(result.label).toBe("Good");
  });

  it("aggressive collector scores F (0, clamped)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    // Deductions: sold(-25) advertising(-10) crossSite(-10) profiling(-8) trainAI(-8)
    //             geolocation(-8) biometric(-8) health(-5) financial(-3)
    //             GPC(-5) DNT(-2) >10 parties(-10) indefinite retention(-10) = -112
    // Bonuses: 0 rights, 0 measures = 0
    // 100 - 112 = -12 → clamped to 0
    expect(result.score).toBe(0);
    expect(result.letter).toBe("F");
    expect(result.label).toBe("Failing");
  });
});

// ─── Rubric version stamp ─────────────────────────────────────────────────────

describe("GradeResult metadata", () => {
  it("stamps the rubric version in the result", () => {
    const result = score(loadFixture("minimal"), rubric);
    expect(result.rubricVersion).toBe(rubric.version);
  });

  it("includes a color hex in the result", () => {
    const result = score(loadFixture("minimal"), rubric);
    expect(result.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ─── Breakdown structure ──────────────────────────────────────────────────────

describe("score() — breakdown", () => {
  it("includes all expected deduction and bonus keys", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    const keys = result.breakdown.map((b) => b.key);
    expect(keys).toContain("soldToThirdParties");
    expect(keys).toContain("sharedForAdvertising");
    expect(keys).toContain("crossSiteTracking");
    expect(keys).toContain("usedForProfiling");
    expect(keys).toContain("usedToTrainAI");
    expect(keys).toContain("collectsPreciseGeolocation");
    expect(keys).toContain("collectsBiometricData");
    expect(keys).toContain("collectsHealthData");
    expect(keys).toContain("collectsFinancialData");
    expect(keys).toContain("doesNotHonorGPC");
    expect(keys).toContain("doesNotHonorDNT");
    expect(keys).toContain("thirdPartiesOver10");
    expect(keys).toContain("thirdParties6To10");
    expect(keys).toContain("retentionIndefinite");
    expect(keys).toContain("retentionOver3Years");
    expect(keys).toContain("retentionOver1Year");
    expect(keys).toContain("consumerRights");
    expect(keys).toContain("securityMeasures");
  });

  it("breakdown items have label and points", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    for (const item of result.breakdown) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.points).toBe("number");
    }
  });

  it("breakdown points sum equals final score minus start", () => {
    const fixture = loadFixture("typical-saas");
    const result = score(fixture, rubric);
    const sumOfPoints = result.breakdown.reduce((acc, b) => acc + b.points, 0);
    expect(rubric.startScore + sumOfPoints).toBe(result.score);
  });
});

// ─── Third-party tiers (mutually exclusive) ───────────────────────────────────

describe("third-party tier deductions", () => {
  it("applies >10 tier for 15 parties (not the 6-10 tier)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const over10 = result.breakdown.find((b) => b.key === "thirdPartiesOver10")!;
    const tier6to10 = result.breakdown.find((b) => b.key === "thirdParties6To10")!;
    expect(over10.triggered).toBe(true);
    expect(over10.points).toBe(-10);
    expect(tier6to10.triggered).toBe(false);
    expect(tier6to10.points).toBe(0);
  });

  it("applies 6-10 tier for 8 parties (not the >10 tier)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    const over10 = result.breakdown.find((b) => b.key === "thirdPartiesOver10")!;
    const tier6to10 = result.breakdown.find((b) => b.key === "thirdParties6To10")!;
    expect(over10.triggered).toBe(false);
    expect(tier6to10.triggered).toBe(true);
    expect(tier6to10.points).toBe(-5);
  });

  it("applies neither tier for 0 parties", () => {
    const result = score(loadFixture("minimal"), rubric);
    const over10 = result.breakdown.find((b) => b.key === "thirdPartiesOver10")!;
    const tier6to10 = result.breakdown.find((b) => b.key === "thirdParties6To10")!;
    expect(over10.triggered).toBe(false);
    expect(tier6to10.triggered).toBe(false);
  });
});

// ─── Retention tiers (mutually exclusive) ─────────────────────────────────────

describe("retention tier deductions", () => {
  it("applies indefinite tier when indefinite=true", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    const over1yr = result.breakdown.find((b) => b.key === "retentionOver1Year")!;
    expect(indefinite.triggered).toBe(true);
    expect(over3yr.triggered).toBe(false);
    expect(over1yr.triggered).toBe(false);
  });

  it("applies >1yr tier for 1095-day retention (exactly 3 years, not > 3 years)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    const over1yr = result.breakdown.find((b) => b.key === "retentionOver1Year")!;
    expect(indefinite.triggered).toBe(false);
    expect(over3yr.triggered).toBe(false); // 1095 is not > 1095
    expect(over1yr.triggered).toBe(true);  // 1095 > 365
  });

  it("applies no retention tier for 30-day retention", () => {
    const result = score(loadFixture("minimal"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    const over1yr = result.breakdown.find((b) => b.key === "retentionOver1Year")!;
    expect(indefinite.triggered).toBe(false);
    expect(over3yr.triggered).toBe(false);
    expect(over1yr.triggered).toBe(false);
  });
});

// ─── Bonus caps ───────────────────────────────────────────────────────────────

describe("bonus caps", () => {
  it("caps consumer rights bonus at 6 rights (+12)", () => {
    // Build an extraction with all 6 rights = true
    const fixture = loadFixture("minimal");
    const allRights: PrivacyFacts = {
      ...fixture,
      consumerRights: {
        rightToAccess: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToDelete: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToPortability: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToCorrect: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToOptOut: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToNonDiscrimination: { value: true, confidence: 1, sourceQuote: "yes" },
      },
    };
    const result = score(allRights, rubric);
    const rightsItem = result.breakdown.find((b) => b.key === "consumerRights")!;
    expect(rightsItem.points).toBe(12); // 6 × 2
  });

  it("caps security measures bonus at 5 measures (+10)", () => {
    const fixture = loadFixture("minimal");
    const manyMeasures: PrivacyFacts = {
      ...fixture,
      security: {
        measures: Array.from({ length: 10 }, (_, i) => ({
          name: `Measure ${i + 1}`,
          sourceQuote: "yes",
        })),
      },
    };
    const result = score(manyMeasures, rubric);
    const secItem = result.breakdown.find((b) => b.key === "securityMeasures")!;
    expect(secItem.points).toBe(10); // capped at 5 × 2
  });
});

// ─── Score clamping ───────────────────────────────────────────────────────────

describe("score clamping", () => {
  it("never exceeds 100", () => {
    const fixture = loadFixture("minimal");
    const result = score(fixture, rubric);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("never goes below 0", () => {
    const fixture = loadFixture("aggressive");
    const result = score(fixture, rubric);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Grade boundary values ────────────────────────────────────────────────────

describe("grade boundaries", () => {
  /**
   * Builds a clean base fixture (score = 100): all practices false, no bonuses.
   * Each flag costs exactly the rubric value, so we can build exact target scores.
   */
  function cleanBase(): PrivacyFacts {
    return loadFixture("minimal") as PrivacyFacts & {
      // We override everything below
    };
  }

  type Flags = {
    sold?: boolean;
    advertising?: boolean;
    crossSite?: boolean;
    profiling?: boolean;
    trainAI?: boolean;
    geo?: boolean;
    biometric?: boolean;
    health?: boolean;
    financial?: boolean;
    noGPC?: boolean;
    noDNT?: boolean;
  };

  function fixture(flags: Flags = {}): PrivacyFacts {
    const base = cleanBase();
    const bp = (v: boolean) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    return {
      ...base,
      consumerRights: {
        rightToAccess: bp(false),
        rightToDelete: bp(false),
        rightToPortability: bp(false),
        rightToCorrect: bp(false),
        rightToOptOut: bp(false),
        rightToNonDiscrimination: bp(false),
      },
      security: { measures: [] },
      signalHonoring: {
        honorsGPC: bp(!flags.noGPC),
        honorsDNT: bp(!flags.noDNT),
      },
      dataSharing: {
        soldToThirdParties: bp(!!flags.sold),
        sharedForAdvertising: bp(!!flags.advertising),
        crossSiteTracking: bp(!!flags.crossSite),
        usedForProfiling: bp(!!flags.profiling),
        usedToTrainAI: bp(!!flags.trainAI),
        thirdPartyCount: 0,
      },
      dataCollection: {
        ...base.dataCollection,
        collectsPreciseGeolocation: bp(!!flags.geo),
        collectsBiometricData: bp(!!flags.biometric),
        collectsHealthData: bp(!!flags.health),
        collectsFinancialData: bp(!!flags.financial),
      },
      retention: { retentionDays: 30, indefinite: false, sourceQuote: "30 days" },
    };
  }

  // Deduction sums used (all verified against rubric):
  // sold=-25, advertising=-10, crossSite=-10, profiling=-8,
  // geo=-8, health=-5, financial=-3, GPC=-5, DNT=-2
  const cases: [number, string, Flags][] = [
    [100, "A",  {}],
    // 100 - 10(advertising) - 5(GPC) = 85
    [85,  "A",  { advertising: true, noGPC: true }],
    // 100 - 8(geo) - 5(health) - 3(financial) = 84
    [84,  "B",  { geo: true, health: true, financial: true }],
    // 100 - 25(sold) - 5(GPC) = 70
    [70,  "B",  { sold: true, noGPC: true }],
    // 100 - 10(crossSite) - 10(advertising) - 8(profiling) - 3(financial) = 69
    [69,  "C",  { crossSite: true, advertising: true, profiling: true, financial: true }],
    // 100 - 25(sold) - 10(advertising) - 5(GPC) - 5(health) = 55
    [55,  "C",  { sold: true, advertising: true, noGPC: true, health: true }],
    // 100 - 25(sold) - 10(advertising) - 8(profiling) - 3(financial) = 54
    [54,  "D",  { sold: true, advertising: true, profiling: true, financial: true }],
    // 100 - 25(sold) - 10(advertising) - 10(crossSite) - 8(profiling) - 5(GPC) - 2(DNT) = 40
    [40,  "D",  { sold: true, advertising: true, crossSite: true, profiling: true, noGPC: true, noDNT: true }],
    // 100 - 25(sold) - 10(advertising) - 10(crossSite) - 8(profiling) - 5(GPC) - 3(financial) = 39
    [39,  "F",  { sold: true, advertising: true, crossSite: true, profiling: true, noGPC: true, financial: true }],
    [0,   "F",  {}], // aggressive fixture already lands at 0
  ];

  it.each(cases)("score %i → letter %s", (targetScore, expectedLetter, flags) => {
    const f = targetScore === 0 ? loadFixture("aggressive") : fixture(flags);
    const result = score(f, rubric);
    if (targetScore !== 0) {
      expect(result.score).toBe(targetScore);
    }
    expect(result.letter).toBe(expectedLetter);
  });
});

// ─── Pure function property ───────────────────────────────────────────────────

describe("score() purity", () => {
  it("returns identical results when called twice with same inputs", () => {
    const fixture = loadFixture("typical-saas");
    const r1 = score(fixture, rubric);
    const r2 = score(fixture, rubric);
    expect(r1).toEqual(r2);
  });

  it("does not mutate the input extraction", () => {
    const fixture = loadFixture("aggressive");
    const before = JSON.stringify(fixture);
    score(fixture, rubric);
    expect(JSON.stringify(fixture)).toBe(before);
  });
});
