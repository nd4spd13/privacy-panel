import { describe, it, expect } from "vitest";
import {
  renderNeutralToSVG,
  renderNeutralToHTML,
  renderToSVG,
  renderToHTML,
  renderEmbedSnippet,
} from "@/core/rendering/embed";
import type { PrivacyPanel } from "@/core/schema/types";
import type { GradeResult } from "@/core/scoring/engine";

const SAMPLE_DATA: PrivacyPanel = {
  metadata: {
    schemaVersion: "2.0.0",
    companyName: "Acme Corp",
    policyUrl: "https://acme.example.com/privacy",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    policyHash: "abc123",
  },
  dataCollection: {
    items: [
      { category: "contact_info", name: "Email address", sensitive: false, sourceQuote: "We collect email." },
      { category: "financial_info", name: "Payment data", sensitive: true, sourceQuote: "We collect payment info." },
    ],
    sensitiveTaxonomy: {
      preciseGeolocation: false,
      financialPaymentData: true,
      governmentIds: false,
      biometricIdentifiers: false,
      healthData: false,
      geneticData: false,
      sexualOrientationGenderIdentity: false,
      racialEthnicOrigin: false,
      communicationsContent: false,
      childrensData: false,
    },
    collectsPreciseGeolocation: { value: false, confidence: 1, sourceQuote: "No location." },
    collectsBiometricData: { value: false, confidence: 1, sourceQuote: "No biometrics." },
    collectsHealthData: { value: false, confidence: 1, sourceQuote: "No health data." },
    collectsFinancialData: { value: true, confidence: 1, sourceQuote: "Payment info." },
  },
  dataSharing: {
    soldToThirdParties: { value: false, confidence: 1, sourceQuote: "We do not sell data." },
    sharedForAdvertising: { value: false, confidence: 1, sourceQuote: "No ad sharing." },
    crossSiteTracking: { value: false, confidence: 1, sourceQuote: "No cross-site tracking." },
    usedForProfiling: { value: false, confidence: 1, sourceQuote: "No profiling." },
    usedToTrainAI: { value: false, confidence: 1, sourceQuote: "No AI training." },
    disclosedToLawEnforcement: { value: false, confidence: 0.8, sourceQuote: "Only if required by law." },
  },
  thirdPartyRecipients: {
    categoryCount: 2,
    categories: ["Payments", "Analytics"],
    includesAdvertising: false,
    includesLawEnforcement: false,
    sourceQuote: "We use payment processors and analytics.",
  },
  purposes: {
    provideCoreService: { value: true, confidence: 1, sourceQuote: "We operate the service." },
    securityFraudPrevention: { value: true, confidence: 0.9, sourceQuote: "For security." },
    legalRegulatoryCompliance: { value: false, confidence: 1, sourceQuote: "N/A." },
    advertisingMarketing: { value: false, confidence: 1, sourceQuote: "No ads." },
    personalization: { value: false, confidence: 1, sourceQuote: "No personalization." },
    analyticsResearch: { value: true, confidence: 1, sourceQuote: "Analytics." },
    serviceImprovement: { value: true, confidence: 0.9, sourceQuote: "Improve the service." },
    paymentProcessing: { value: true, confidence: 1, sourceQuote: "Process payments." },
    aiMlTraining: { value: false, confidence: 1, sourceQuote: "No AI training." },
    thirdPartyDataPartnerships: { value: false, confidence: 1, sourceQuote: "No data partners." },
    other: { value: null, description: null, sourceQuote: "" },
  },
  retention: {
    longestStatedPeriod: "2 years",
    variesByDataType: false,
    legallyMandatedRetention: false,
    summary: "Data retained for 2 years.",
    sourceQuote: "We retain your data for up to 2 years.",
  },
  consumerRights: {
    rightToAccess: { value: true, confidence: 1, sourceQuote: "You can access your data." },
    rightToDelete: { value: true, confidence: 1, sourceQuote: "You can delete your data." },
    rightToPortability: { value: false, confidence: 1, sourceQuote: "No portability." },
    rightToCorrect: { value: true, confidence: 0.9, sourceQuote: "You can correct your data." },
    rightToOptOut: { value: true, confidence: 1, sourceQuote: "You can opt out." },
  },
  signalHonoring: {
    honorsBrowserPrivacySignals: "yes",
    gpcDetail: { value: true, confidence: 0.9, sourceQuote: "We honor GPC." },
    dntDetail: { value: false, confidence: 0.9, sourceQuote: "We do not honor DNT." },
  },
  security: {
    encryptedInTransit: { value: true, confidence: 1, sourceQuote: "All traffic over HTTPS." },
    encryptedAtRest: { value: true, confidence: 0.8, sourceQuote: "Data encrypted at rest." },
    mfaAvailable: { value: true, confidence: 1, sourceQuote: "MFA is available." },
    breachNotification: { value: true, confidence: 0.9, sourceQuote: "We notify of breaches." },
    additionalMeasures: [],
  },
  supplementary: {
    independentAudits: { value: false, confidence: 1, sourceQuote: "No audits." },
  },
};

const SAMPLE_GRADE: GradeResult = {
  score: 72,
  letter: "B",
  label: "Good",
  rubricVersion: "1",
  color: "#4d7c0f",
  breakdown: [],
};

describe("renderNeutralToSVG", () => {
  it("includes company name", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).toContain("Acme Corp");
  });

  it("includes Privacy Panel title", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).toContain("Privacy Panel");
  });

  it("includes factual sections", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).toContain("Data Collected");
    expect(svg).toContain("Data Sharing");
    expect(svg).toContain("Consumer Rights");
    expect(svg).toContain("Privacy Signals");
  });

  it("does not contain a grade circle (letter in colored circle)", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    // Grade header bar has a colored background div with the letter grade
    expect(svg).not.toMatch(/border-radius:50%[^}]*>[A-F]</);
  });

  it("does not contain score/100 notation", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).not.toContain("/100");
  });

  it("does not contain rubric version line", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).not.toContain("Rubric v");
  });

  it("does not contain grade labels (Excellent/Good/Fair/Poor/Failing)", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).not.toContain("Excellent");
    expect(svg).not.toContain("Failing");
  });

  it("is valid SVG with correct width attribute", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 480);
    expect(svg).toContain('width="480"');
    expect(svg).toMatch(/<svg/);
  });

  it("height scales proportionally to width", () => {
    const svg380 = renderNeutralToSVG(SAMPLE_DATA, 380);
    const svg480 = renderNeutralToSVG(SAMPLE_DATA, 480);
    const h380 = parseInt(svg380.match(/height="(\d+)"/)![1]);
    const h480 = parseInt(svg480.match(/height="(\d+)"/)![1]);
    // Height should be proportional: h480/480 ≈ h380/380
    expect(Math.round(h480 / 480)).toBe(Math.round(h380 / 380));
  });

  it("wraps content in SVG foreignObject", () => {
    const svg = renderNeutralToSVG(SAMPLE_DATA, 380);
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain("</foreignObject>");
  });
});

describe("renderToSVG (graded)", () => {
  it("includes grade letter and score", () => {
    const svg = renderToSVG(SAMPLE_DATA, SAMPLE_GRADE, 380);
    expect(svg).toContain("B");
    expect(svg).toContain("72");
    expect(svg).toContain("/100");
  });

  it("includes Rubric version line", () => {
    const svg = renderToSVG(SAMPLE_DATA, SAMPLE_GRADE, 380);
    expect(svg).toContain("Rubric v");
  });

  it("is taller than neutral SVG at same width (grade header adds height)", () => {
    const graded = renderToSVG(SAMPLE_DATA, SAMPLE_GRADE, 380);
    const neutral = renderNeutralToSVG(SAMPLE_DATA, 380);
    const gradedH = parseInt(graded.match(/height="(\d+)"/)![1]);
    const neutralH = parseInt(neutral.match(/height="(\d+)"/)![1]);
    expect(gradedH).toBeGreaterThan(neutralH);
  });
});

describe("renderNeutralToHTML", () => {
  it("includes company name and Privacy Panel title", () => {
    const html = renderNeutralToHTML(SAMPLE_DATA, 380);
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Privacy Panel");
  });

  it("does not contain grade header or score", () => {
    const html = renderNeutralToHTML(SAMPLE_DATA, 380);
    expect(html).not.toContain("/100");
    expect(html).not.toContain("Rubric v");
  });
});

describe("renderToHTML (graded)", () => {
  it("includes grade and score", () => {
    const html = renderToHTML(SAMPLE_DATA, SAMPLE_GRADE, 380);
    expect(html).toContain("72/100");
    expect(html).toContain("Good");
  });
});

describe("renderEmbedSnippet", () => {
  it("includes grade suffix in title when withGrade=true (default)", () => {
    const snippet = renderEmbedSnippet(SAMPLE_DATA, SAMPLE_GRADE, "https://privacypanel.org", 380, true);
    expect(snippet).toContain("Grade B");
  });

  it("omits grade suffix when withGrade=false", () => {
    const snippet = renderEmbedSnippet(SAMPLE_DATA, SAMPLE_GRADE, "https://privacypanel.org", 380, false);
    expect(snippet).not.toContain("Grade");
  });

  it("neutral iframe is shorter than graded (height difference)", () => {
    const graded = renderEmbedSnippet(SAMPLE_DATA, SAMPLE_GRADE, "https://privacypanel.org", 380, true);
    const neutral = renderEmbedSnippet(SAMPLE_DATA, SAMPLE_GRADE, "https://privacypanel.org", 380, false);
    const gradedH = parseInt(graded.match(/height="(\d+)"/)![1]);
    const neutralH = parseInt(neutral.match(/height="(\d+)"/)![1]);
    expect(gradedH).toBeGreaterThan(neutralH);
  });
});
