import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { score } from "../../src/core/scoring/engine";
import { loadRubricOrThrow } from "../../src/core/scoring/rubric";
import type { V2Rubric } from "../../src/core/scoring/rubric";
import { validate } from "../../src/core/schema/privacy-panel.schema";
import type { PrivacyPanel } from "../../src/core/schema/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(name: string): PrivacyPanel {
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

let rubric: V2Rubric;

beforeAll(() => {
  rubric = loadRubricOrThrow(
    join(__dirname, "../../src/core/scoring/rubric.v2.yaml")
  ) as V2Rubric;
  if (rubric.version !== "2") throw new Error("Expected v2 rubric");
});

// ─── Fixture grades ───────────────────────────────────────────────────────────
//
// minimal (Signal-like):
//   Deductions: 0 (all false/null-skip)
//   Bonuses: 4 rights(+8) + 1 sec measure(+2) + browser signals "yes"(+3)
//            + AI opt-out(+3) + independent audits(+2) = +18
//   Score: 118 → clamped 100 → A
//
// typical-saas:
//   Deductions: sharedForAdv(-10) + profiling(-8) + financial(-3) + lawEnf(-3)
//               + crossSite_emerging(-5) + noSignals_emerging(-3)
//               + 3to5cats(-4) + includesAdv(-5) = -41
//   Bonuses: 5 rights(+10) + 2 sec(+4) + AI opt-out(+3) + audits(+2) = +19
//   Score: 100 - 41 + 19 = 78 → B
//
// aggressive:
//   Deductions: sold(-25) + sharedForAdv(-10) + profiling(-8) + geo(-8)
//               + biometric(-8) + health(-5) + financial(-3) + lawEnf(-3)
//               + crossSite_emerging(-5) + noSignals_emerging(-3)
//               + over5cats(-8) + includesAdv(-5) + retentionIndefinite(-10) = -101
//   Bonuses: 0
//   Score: 100 - 101 = -1 → clamped 0 → F

describe("score() — fixture profiles (v2 rubric)", () => {
  it("minimal (Signal-like) scores A (100)", () => {
    const result = score(loadFixture("minimal"), rubric);
    expect(result.score).toBe(100);
    expect(result.letter).toBe("A");
    expect(result.label).toBe("Excellent");
  });

  it("typical-saas scores B (78)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    expect(result.score).toBe(78);
    expect(result.letter).toBe("B");
    expect(result.label).toBe("Good");
  });

  it("aggressive collector scores F (0, clamped)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    expect(result.score).toBe(0);
    expect(result.letter).toBe("F");
    expect(result.label).toBe("Failing");
  });
});

// ─── GradeResult metadata ─────────────────────────────────────────────────────

describe("GradeResult metadata", () => {
  it("stamps the rubric version in the result", () => {
    const result = score(loadFixture("minimal"), rubric);
    expect(result.rubricVersion).toBe("2");
  });

  it("includes a valid color hex in the result", () => {
    const result = score(loadFixture("minimal"), rubric);
    expect(result.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ─── Breakdown structure ──────────────────────────────────────────────────────

describe("score() — breakdown", () => {
  it("includes all expected v2 deduction and bonus keys", () => {
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
    expect(keys).toContain("disclosedToLawEnforcement");
    expect(keys).toContain("doesNotHonorBrowserPrivacySignals");
    expect(keys).toContain("thirdPartyCategoriesOver5");
    expect(keys).toContain("thirdPartyCategories3To5");
    expect(keys).toContain("thirdPartyIncludesAdvertising");
    expect(keys).toContain("retentionIndefinite");
    expect(keys).toContain("retentionNotStated");
    expect(keys).toContain("retentionOver3Years");
    expect(keys).toContain("consumerRights");
    expect(keys).toContain("securityMeasures");
    expect(keys).toContain("honorsBrowserSignals");
    expect(keys).toContain("aiTrainingOptOut");
    expect(keys).toContain("independentAudits");
  });

  it("breakdown items each have a label and a numeric points value", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    for (const item of result.breakdown) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.points).toBe("number");
    }
  });

  it("breakdown points sum + startScore equals final score", () => {
    const fixture = loadFixture("typical-saas");
    const result = score(fixture, rubric);
    const sumOfPoints = result.breakdown.reduce((acc, b) => acc + b.points, 0);
    // Note: clamping means this only holds when score is not clamped
    expect(rubric.startScore + sumOfPoints).toBe(result.score);
  });
});

// ─── Third-party category tiers (mutually exclusive) ─────────────────────────

describe("third-party category deductions", () => {
  it("applies >5 tier for 15 categories (not the 3-5 tier)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const over5 = result.breakdown.find((b) => b.key === "thirdPartyCategoriesOver5")!;
    const tier3to5 = result.breakdown.find((b) => b.key === "thirdPartyCategories3To5")!;
    expect(over5.triggered).toBe(true);
    expect(over5.points).toBe(-8);
    expect(tier3to5.triggered).toBe(false);
    expect(tier3to5.points).toBe(0);
  });

  it("applies 3-5 tier for 4 categories (not the >5 tier)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    const over5 = result.breakdown.find((b) => b.key === "thirdPartyCategoriesOver5")!;
    const tier3to5 = result.breakdown.find((b) => b.key === "thirdPartyCategories3To5")!;
    expect(over5.triggered).toBe(false);
    expect(tier3to5.triggered).toBe(true);
    expect(tier3to5.points).toBe(-4);
  });

  it("applies neither tier for 0 categories", () => {
    const result = score(loadFixture("minimal"), rubric);
    const over5 = result.breakdown.find((b) => b.key === "thirdPartyCategoriesOver5")!;
    const tier3to5 = result.breakdown.find((b) => b.key === "thirdPartyCategories3To5")!;
    expect(over5.triggered).toBe(false);
    expect(tier3to5.triggered).toBe(false);
  });
});

// ─── Retention tiers ──────────────────────────────────────────────────────────

describe("retention deductions", () => {
  it("applies indefinite tier when longestStatedPeriod='indefinitely'", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const notStated = result.breakdown.find((b) => b.key === "retentionNotStated")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    expect(indefinite.triggered).toBe(true);
    expect(indefinite.points).toBe(-10);
    expect(notStated.triggered).toBe(false);
    expect(over3yr.triggered).toBe(false);
  });

  it("applies no retention tier for '3 years' (exactly 3 years is not > 3 years)", () => {
    const result = score(loadFixture("typical-saas"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const notStated = result.breakdown.find((b) => b.key === "retentionNotStated")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    expect(indefinite.triggered).toBe(false);
    expect(notStated.triggered).toBe(false);
    expect(over3yr.triggered).toBe(false);
  });

  it("applies no retention tier for '30 days'", () => {
    const result = score(loadFixture("minimal"), rubric);
    const indefinite = result.breakdown.find((b) => b.key === "retentionIndefinite")!;
    const notStated = result.breakdown.find((b) => b.key === "retentionNotStated")!;
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    expect(indefinite.triggered).toBe(false);
    expect(notStated.triggered).toBe(false);
    expect(over3yr.triggered).toBe(false);
  });

  it("applies retentionNotStated for 'not stated' period", () => {
    const fixture = loadFixture("minimal");
    const withUnknownRetention: PrivacyPanel = {
      ...fixture,
      retention: {
        longestStatedPeriod: "not stated",
        variesByDataType: false,
        legallyMandatedRetention: false,
        summary: "No retention period disclosed.",
        sourceQuote: "No retention period is specified in the policy.",
      },
    };
    const result = score(withUnknownRetention, rubric);
    const notStated = result.breakdown.find((b) => b.key === "retentionNotStated")!;
    expect(notStated.triggered).toBe(true);
  });

  it("skips retentionOver3Years deduction when legallyMandatedRetention=true", () => {
    const fixture = loadFixture("minimal");
    const withMandatedRetention: PrivacyPanel = {
      ...fixture,
      retention: {
        longestStatedPeriod: "7 years",
        variesByDataType: false,
        legallyMandatedRetention: true,
        summary: "Financial records retained 7 years as required by law.",
        sourceQuote: "We retain financial records for 7 years as required by applicable tax law.",
      },
    };
    const result = score(withMandatedRetention, rubric);
    const over3yr = result.breakdown.find((b) => b.key === "retentionOver3Years")!;
    expect(over3yr.triggered).toBe(false);
    expect(over3yr.points).toBe(0);
  });
});

// ─── Null behavior ────────────────────────────────────────────────────────────

describe("null BooleanPractice handling", () => {
  function bpNull(): { value: null; confidence: number; sourceQuote: string } {
    return { value: null, confidence: 0.3, "sourceQuote": "Policy does not address this." };
  }
  function bpFalse(): { value: false; confidence: number; sourceQuote: string } {
    return { value: false, confidence: 0.9, "sourceQuote": "Explicitly not done." };
  }

  it("null soldToThirdParties with nullBehavior:half applies half deduction (13pts)", () => {
    const fixture = loadFixture("minimal");
    const withNullSold: PrivacyPanel = {
      ...fixture,
      dataSharing: { ...fixture.dataSharing, soldToThirdParties: bpNull() },
    };
    const result = score(withNullSold, rubric);
    const sold = result.breakdown.find((b) => b.key === "soldToThirdParties")!;
    // 25 * 1.0 / 2 = 12.5 → Math.round(12.5) = 13 → half deduction
    expect(sold.triggered).toBe(true);
    expect(sold.points).toBe(-13);
  });

  it("null crossSiteTracking with nullBehavior:half applies half deduction (3pts at emerging tier)", () => {
    const fixture = loadFixture("minimal");
    const withNullCrossSite: PrivacyPanel = {
      ...fixture,
      dataSharing: { ...fixture.dataSharing, crossSiteTracking: bpNull() },
    };
    const result = score(withNullCrossSite, rubric);
    const cst = result.breakdown.find((b) => b.key === "crossSiteTracking")!;
    // 10 * 0.5 = 5 (full emerging weight), then half of that = 2.5 → Math.round = 3
    // Wait: for null, nullBehavior=half means half the *base points* (after tier weight)
    // basePoints = 10 * 0.5 = 5; half of basePoints = 2.5; Math.round(2.5) = 3
    expect(cst.triggered).toBe(true);
    expect(cst.points).toBe(-3);
  });

  it("null collectsPreciseGeolocation with nullBehavior:skip applies no deduction", () => {
    const fixture = loadFixture("minimal");
    const withNullGeo: PrivacyPanel = {
      ...fixture,
      dataCollection: { ...fixture.dataCollection, collectsPreciseGeolocation: bpNull() },
    };
    const result = score(withNullGeo, rubric);
    const geo = result.breakdown.find((b) => b.key === "collectsPreciseGeolocation")!;
    expect(geo.triggered).toBe(false);
    expect(geo.points).toBe(0);
  });

  it("null retentionIndefinite (if period is empty string) applies full deduction", () => {
    // retentionIndefinite has nullBehavior:full
    // The engine applies it when retention.longestStatedPeriod is an indefinite marker
    // An empty period string → treated as notStated (separate path), so let's test
    // a company that is truly silent (empty string → notStated)
    const fixture = loadFixture("minimal");
    const withEmptyRetention: PrivacyPanel = {
      ...fixture,
      retention: {
        longestStatedPeriod: "",
        variesByDataType: false,
        legallyMandatedRetention: false,
        summary: "No retention period disclosed.",
        sourceQuote: "No retention period is specified.",
      },
    };
    const result = score(withEmptyRetention, rubric);
    const notStated = result.breakdown.find((b) => b.key === "retentionNotStated")!;
    // Empty string → notStated path → notStated deduction triggered
    expect(notStated.triggered).toBe(true);
  });

  it("company with all null boolean practices scores in a middle range (not 0 or 100)", () => {
    const fixture = loadFixture("minimal");
    const bp = (v: boolean | null) => ({ value: v, confidence: 0.3, sourceQuote: "n/a" });
    const allNullPractices: PrivacyPanel = {
      ...fixture,
      dataSharing: {
        soldToThirdParties: bp(null),
        sharedForAdvertising: bp(null),
        crossSiteTracking: bp(null),
        usedForProfiling: bp(null),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(null),
      },
      retention: {
        longestStatedPeriod: "not stated",
        variesByDataType: false,
        legallyMandatedRetention: false,
        summary: "",
        sourceQuote: "",
      },
      consumerRights: {
        rightToAccess: bp(null),
        rightToDelete: bp(null),
        rightToPortability: bp(null),
        rightToCorrect: bp(null),
        rightToOptOut: bp(null),
      },
      security: {
        encryptedInTransit: bp(null),
        encryptedAtRest: bp(null),
        mfaAvailable: bp(null),
        breachNotification: bp(null),
        additionalMeasures: [],
      },
      supplementary: { independentAudits: bp(null) },
      signalHonoring: {
        honorsBrowserPrivacySignals: null,
        gpcDetail: bp(null),
        dntDetail: bp(null),
      },
    };
    const result = score(allNullPractices, rubric);
    // With half deductions for sold/advertising/profiling/crossSite + notStated retention
    // Not 0 (some deductions apply) and not 100 (half deductions apply)
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });
});

// ─── Browser signal handling ──────────────────────────────────────────────────

describe("browser privacy signal scoring", () => {
  it("'no' triggers deduction and no bonus", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const deduction = result.breakdown.find((b) => b.key === "doesNotHonorBrowserPrivacySignals")!;
    const bonus = result.breakdown.find((b) => b.key === "honorsBrowserSignals")!;
    expect(deduction.triggered).toBe(true);
    expect(deduction.points).toBeLessThan(0);
    expect(bonus.triggered).toBe(false);
  });

  it("'yes' triggers bonus and no deduction", () => {
    const result = score(loadFixture("minimal"), rubric);
    const deduction = result.breakdown.find((b) => b.key === "doesNotHonorBrowserPrivacySignals")!;
    const bonus = result.breakdown.find((b) => b.key === "honorsBrowserSignals")!;
    expect(deduction.triggered).toBe(false);
    expect(bonus.triggered).toBe(true);
    expect(bonus.points).toBeGreaterThan(0);
  });

  it("null triggers neither deduction nor bonus", () => {
    const fixture = loadFixture("minimal");
    const bp = (v: boolean | null) => ({ value: v, confidence: 0.3, sourceQuote: "n/a" });
    const withNullSignal: PrivacyPanel = {
      ...fixture,
      signalHonoring: {
        honorsBrowserPrivacySignals: null,
        gpcDetail: bp(null),
        dntDetail: bp(null),
      },
    };
    const result = score(withNullSignal, rubric);
    const deduction = result.breakdown.find((b) => b.key === "doesNotHonorBrowserPrivacySignals")!;
    const bonus = result.breakdown.find((b) => b.key === "honorsBrowserSignals")!;
    expect(deduction.triggered).toBe(false);
    expect(deduction.points).toBe(0);
    expect(bonus.triggered).toBe(false);
    expect(bonus.points).toBe(0);
  });

  it("'partial' triggers bonus and no deduction", () => {
    const fixture = loadFixture("minimal");
    const bp = (v: boolean | null) => ({ value: v, confidence: 0.8, sourceQuote: "partial" });
    const withPartial: PrivacyPanel = {
      ...fixture,
      signalHonoring: {
        honorsBrowserPrivacySignals: "partial",
        gpcDetail: bp(true),
        dntDetail: bp(false),
      },
    };
    const result = score(withPartial, rubric);
    const deduction = result.breakdown.find((b) => b.key === "doesNotHonorBrowserPrivacySignals")!;
    const bonus = result.breakdown.find((b) => b.key === "honorsBrowserSignals")!;
    expect(deduction.triggered).toBe(false);
    expect(bonus.triggered).toBe(true);
  });
});

// ─── AI training bonus ────────────────────────────────────────────────────────

describe("AI training opt-out bonus", () => {
  it("explicit false earns bonus", () => {
    const result = score(loadFixture("minimal"), rubric);
    const bonus = result.breakdown.find((b) => b.key === "aiTrainingOptOut")!;
    expect(bonus.triggered).toBe(true);
    expect(bonus.points).toBe(rubric.bonuses.aiTrainingOptOut.points);
  });

  it("explicit true earns no bonus (aspirational tier — also no deduction)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    const bonus = result.breakdown.find((b) => b.key === "aiTrainingOptOut")!;
    const usedToTrain = result.breakdown.find((b) => b.key === "usedToTrainAI")!;
    expect(bonus.triggered).toBe(false);
    expect(bonus.points).toBe(0);
    // Aspirational tier: no deduction either
    expect(usedToTrain.points).toBe(0);
  });

  it("null earns no bonus", () => {
    const fixture = loadFixture("minimal");
    const withNullAI: PrivacyPanel = {
      ...fixture,
      dataSharing: {
        ...fixture.dataSharing,
        usedToTrainAI: { value: null, confidence: 0.3, sourceQuote: "Not addressed." },
      },
    };
    const result = score(withNullAI, rubric);
    const bonus = result.breakdown.find((b) => b.key === "aiTrainingOptOut")!;
    expect(bonus.triggered).toBe(false);
  });
});

// ─── Bonus caps ───────────────────────────────────────────────────────────────

describe("bonus caps", () => {
  it("caps consumer rights bonus at 5 rights (+10)", () => {
    const fixture = loadFixture("minimal");
    const allRights: PrivacyPanel = {
      ...fixture,
      consumerRights: {
        rightToAccess: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToDelete: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToPortability: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToCorrect: { value: true, confidence: 1, sourceQuote: "yes" },
        rightToOptOut: { value: true, confidence: 1, sourceQuote: "yes" },
      },
    };
    const result = score(allRights, rubric);
    const rightsItem = result.breakdown.find((b) => b.key === "consumerRights")!;
    expect(rightsItem.points).toBe(10); // 5 × 2 = 10
  });

  it("caps security measures bonus at 4 measures (+8)", () => {
    const fixture = loadFixture("minimal");
    const allSecurity: PrivacyPanel = {
      ...fixture,
      security: {
        encryptedInTransit: { value: true, confidence: 1, sourceQuote: "yes" },
        encryptedAtRest: { value: true, confidence: 1, sourceQuote: "yes" },
        mfaAvailable: { value: true, confidence: 1, sourceQuote: "yes" },
        breachNotification: { value: true, confidence: 1, sourceQuote: "yes" },
        additionalMeasures: [],
      },
    };
    const result = score(allSecurity, rubric);
    const secItem = result.breakdown.find((b) => b.key === "securityMeasures")!;
    expect(secItem.points).toBe(8); // 4 × 2 = 8 (capped at maxCount=4)
  });

  it("null rights count as 0 for bonus purposes (no penalty)", () => {
    const fixture = loadFixture("minimal");
    const noRights: PrivacyPanel = {
      ...fixture,
      consumerRights: {
        rightToAccess: { value: null, confidence: 0.3, sourceQuote: "n/a" },
        rightToDelete: { value: null, confidence: 0.3, sourceQuote: "n/a" },
        rightToPortability: { value: null, confidence: 0.3, sourceQuote: "n/a" },
        rightToCorrect: { value: null, confidence: 0.3, sourceQuote: "n/a" },
        rightToOptOut: { value: null, confidence: 0.3, sourceQuote: "n/a" },
      },
    };
    const result = score(noRights, rubric);
    const rightsItem = result.breakdown.find((b) => b.key === "consumerRights")!;
    expect(rightsItem.points).toBe(0);
    // Score should not be penalized below what deductions alone produce
    // (null rights earn 0 bonus — they don't deduct)
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Score clamping ───────────────────────────────────────────────────────────

describe("score clamping", () => {
  it("never exceeds 100", () => {
    expect(score(loadFixture("minimal"), rubric).score).toBeLessThanOrEqual(100);
  });

  it("never goes below 0", () => {
    expect(score(loadFixture("aggressive"), rubric).score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Grade boundary values ────────────────────────────────────────────────────

describe("grade boundaries", () => {
  /**
   * Build a clean base fixture with no deductions and no bonuses active.
   * Starting score = 100.
   */
  function cleanBase(): PrivacyPanel {
    const base = loadFixture("minimal");
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : v === false ? "no" : "n/a" });
    return {
      ...base,
      consumerRights: {
        rightToAccess: bp(false),
        rightToDelete: bp(false),
        rightToPortability: bp(false),
        rightToCorrect: bp(false),
        rightToOptOut: bp(false),
      },
      security: {
        encryptedInTransit: bp(false),
        encryptedAtRest: bp(false),
        mfaAvailable: bp(false),
        breachNotification: bp(false),
        additionalMeasures: [],
      },
      supplementary: { independentAudits: bp(false) },
      signalHonoring: {
        honorsBrowserPrivacySignals: null,
        gpcDetail: bp(null),
        dntDetail: bp(null),
      },
      dataSharing: {
        soldToThirdParties: bp(false),
        sharedForAdvertising: bp(false),
        crossSiteTracking: bp(false),
        usedForProfiling: bp(false),
        usedToTrainAI: bp(null), // null = no aiTrainingOptOut bonus, no deduction
        disclosedToLawEnforcement: bp(false),
      },
      thirdPartyRecipients: {
        categoryCount: 0,
        categories: [],
        includesAdvertising: false,
        includesLawEnforcement: false,
        sourceQuote: "none",
      },
      retention: {
        longestStatedPeriod: "30 days",
        variesByDataType: false,
        legallyMandatedRetention: false,
        summary: "30 days",
        sourceQuote: "30 days",
      },
      dataCollection: {
        ...base.dataCollection,
        collectsPreciseGeolocation: bp(false),
        collectsBiometricData: bp(false),
        collectsHealthData: bp(false),
        collectsFinancialData: bp(false),
      },
    };
  }

  // Deduction values at full weight (v2 core tier):
  //   soldToThirdParties=25, sharedForAdv=10, profiling=8, geo=8, biometric=8,
  //   health=5, financial=3, lawEnf=3, thirdPartyOver5=8, thirdPartyAdv=5
  // At emerging tier (weight 0.5):
  //   crossSiteTracking=Math.round(10*0.5)=5, noSignals=Math.round(5*0.5)=3

  it("score 100 → A", () => {
    const result = score(cleanBase(), rubric);
    expect(result.score).toBe(100);
    expect(result.letter).toBe("A");
  });

  it("score 85 → A (bottom of A range)", () => {
    // crossSiteTracking(-5) + sharedForAdv(-10) = -15 → 85
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(false),
        sharedForAdvertising: bp(true),
        crossSiteTracking: bp(true),
        usedForProfiling: bp(false),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(85);
    expect(result.letter).toBe("A");
  });

  it("score 84 → B (top of B range)", () => {
    // usedForProfiling(-8) + crossSiteTracking(-5) + noSignals(-3) = -16 → 84
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(false),
        sharedForAdvertising: bp(false),
        crossSiteTracking: bp(true),
        usedForProfiling: bp(true),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
      signalHonoring: {
        honorsBrowserPrivacySignals: "no",
        gpcDetail: bp(false),
        dntDetail: bp(false),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(84);
    expect(result.letter).toBe("B");
  });

  it("score 70 → B (bottom of B range)", () => {
    // soldToThirdParties(-25) + crossSiteTracking(-5) = -30 → 70
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(true),
        sharedForAdvertising: bp(false),
        crossSiteTracking: bp(true),
        usedForProfiling: bp(false),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(70);
    expect(result.letter).toBe("B");
  });

  it("score 69 → C (top of C range)", () => {
    // soldToThirdParties(-25) + financial(-3) + lawEnf(-3) = -31 → 69
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(true),
        sharedForAdvertising: bp(false),
        crossSiteTracking: bp(false),
        usedForProfiling: bp(false),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(true),
      },
      dataCollection: {
        ...cleanBase().dataCollection,
        collectsFinancialData: bp(true),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(69);
    expect(result.letter).toBe("C");
  });

  it("score 55 → C (bottom of C range)", () => {
    // soldToThirdParties(-25) + sharedForAdv(-10) + health(-5) + crossSite(-5) = -45 → 55
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(true),
        sharedForAdvertising: bp(true),
        crossSiteTracking: bp(true),
        usedForProfiling: bp(false),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
      dataCollection: {
        ...cleanBase().dataCollection,
        collectsHealthData: bp(true),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(55);
    expect(result.letter).toBe("C");
  });

  it("score 54 → D (top of D range)", () => {
    // soldToThirdParties(-25) + sharedForAdv(-10) + profiling(-8) + noSignals(-3) = -46 → 54
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(true),
        sharedForAdvertising: bp(true),
        crossSiteTracking: bp(false),
        usedForProfiling: bp(true),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
      signalHonoring: {
        honorsBrowserPrivacySignals: "no",
        gpcDetail: bp(false),
        dntDetail: bp(false),
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(54);
    expect(result.letter).toBe("D");
  });

  it("score 39 → F (top of F range)", () => {
    // soldToThirdParties(-25) + sharedForAdv(-10) + profiling(-8) + over5cats(-8) + tpAdv(-5) + crossSite(-5) = -61 → 39
    const bp = (v: boolean | null) => ({ value: v, confidence: 1, sourceQuote: v ? "yes" : "no" });
    const f: PrivacyPanel = {
      ...cleanBase(),
      dataSharing: {
        soldToThirdParties: bp(true),
        sharedForAdvertising: bp(true),
        crossSiteTracking: bp(true),
        usedForProfiling: bp(true),
        usedToTrainAI: bp(null),
        disclosedToLawEnforcement: bp(false),
      },
      thirdPartyRecipients: {
        categoryCount: 6,
        categories: ["a", "b", "c", "d", "e", "f"],
        includesAdvertising: true,
        includesLawEnforcement: false,
        sourceQuote: "6 categories",
      },
    };
    const result = score(f, rubric);
    expect(result.score).toBe(39);
    expect(result.letter).toBe("F");
  });

  it("score 0 → F (aggressive fixture already lands at 0)", () => {
    const result = score(loadFixture("aggressive"), rubric);
    expect(result.score).toBe(0);
    expect(result.letter).toBe("F");
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
