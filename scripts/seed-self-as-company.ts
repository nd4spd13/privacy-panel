#!/usr/bin/env tsx
/**
 * Idempotent seed: inserts Privacy Panel itself as a company in the directory.
 * Re-run whenever SELF_DATA in src/app/privacy/page.tsx changes.
 *
 * Usage: npx tsx scripts/seed-self-as-company.ts
 */
import { join } from "path";
import { upsertCompany } from "../src/db/companies";
import { getDb } from "../src/db/client";
import { loadRubricOrThrow } from "../src/core/scoring/rubric";
import { score } from "../src/core/scoring/engine";
import type { PrivacyPanel } from "../src/core/schema/types";

const SELF_DATA: PrivacyPanel = {
  metadata: {
    schemaVersion: "2.0.0",
    companyName: "Privacy Panel",
    policyUrl: "https://privacypanel.org/privacy",
    analyzedAt: new Date().toISOString(),
    policyHash: "0000000000000000000000000000000000000000000000000000000000000000",
    policyEffectiveDate: "2026-05-12",
  },
  dataCollection: {
    items: [
      {
        category: "usage_analytics",
        name: "App Usage & Diagnostics",
        sensitive: false,
        sourceQuote:
          "Self-managed Plausible CE captures page views, referrers, and a View Company event. Aggregate only.",
      },
      {
        category: "identifiers",
        name: "Server access logs (IP, user agent)",
        sensitive: false,
        sourceQuote:
          "Railway captures HTTP access logs including IP addresses and user agents.",
      },
    ],
    sensitiveTaxonomy: {
      preciseGeolocation: false,
      financialPaymentData: false,
      governmentIds: false,
      biometricIdentifiers: false,
      healthData: false,
      geneticData: false,
      sexualOrientationGenderIdentity: false,
      racialEthnicOrigin: false,
      communicationsContent: false,
      childrensData: false,
    },
    collectsPreciseGeolocation: { value: false, confidence: 1, sourceQuote: "Plausible does not collect precise location." },
    collectsBiometricData: { value: false, confidence: 1, sourceQuote: "No biometric data collected." },
    collectsHealthData: { value: false, confidence: 1, sourceQuote: "No health data collected." },
    collectsFinancialData: { value: false, confidence: 1, sourceQuote: "No financial data collected." },
  },
  dataSharing: {
    soldToThirdParties: { value: false, confidence: 1, sourceQuote: "We do not sell data to any party." },
    sharedForAdvertising: { value: false, confidence: 1, sourceQuote: "No advertising networks or marketing pixels are integrated." },
    crossSiteTracking: { value: false, confidence: 1, sourceQuote: "Plausible CE does not use cookies or cross-site identifiers." },
    usedForProfiling: { value: false, confidence: 1, sourceQuote: "No profiling or automated decision-making." },
    usedToTrainAI: { value: false, confidence: 1, sourceQuote: "Visitor data is not used to train any AI model." },
    disclosedToLawEnforcement: {
      value: false,
      confidence: 0.8,
      sourceQuote: "We hold no individual records to disclose.",
    },
  },
  thirdPartyRecipients: {
    categoryCount: 1,
    categories: ["Hosting & infrastructure (Railway)"],
    includesAdvertising: false,
    includesLawEnforcement: false,
    sourceQuote: "Privacy Panel is operated on Railway. No advertising, marketing, or data partners.",
  },
  purposes: {
    provideCoreService: { value: true, confidence: 1, sourceQuote: "The site delivers privacy policy analysis to visitors." },
    securityFraudPrevention: { value: true, confidence: 0.9, sourceQuote: "Rate limiting on public APIs uses transient IP records to prevent abuse." },
    legalRegulatoryCompliance: { value: false, confidence: 1, sourceQuote: "No regulated data held." },
    advertisingMarketing: { value: false, confidence: 1, sourceQuote: "No advertising or marketing." },
    personalization: { value: false, confidence: 1, sourceQuote: "No personalization." },
    analyticsResearch: { value: true, confidence: 1, sourceQuote: "Aggregate analytics via Plausible CE." },
    serviceImprovement: { value: true, confidence: 0.9, sourceQuote: "Analytics inform which features are used." },
    paymentProcessing: { value: false, confidence: 1, sourceQuote: "No payments processed." },
    aiMlTraining: { value: false, confidence: 1, sourceQuote: "Visitor data is not used to train AI." },
    thirdPartyDataPartnerships: { value: false, confidence: 1, sourceQuote: "No data partnerships." },
    other: { value: null, description: null, sourceQuote: "" },
  },
  retention: {
    longestStatedPeriod: "Indefinite (aggregate analytics)",
    variesByDataType: true,
    legallyMandatedRetention: false,
    summary: "Analytics: indefinite (aggregate). Logs: weeks via Railway. Rate-limit: 1hr.",
    sourceQuote: "Plausible aggregates retained indefinitely with no per-user records.",
  },
  consumerRights: {
    rightToAccess: { value: true, confidence: 1, sourceQuote: "Email hello@privacypanel.org to request a data inquiry." },
    rightToDelete: { value: true, confidence: 1, sourceQuote: "Email hello@privacypanel.org to request deletion." },
    rightToPortability: { value: true, confidence: 0.9, sourceQuote: "We hold so little individual data that portability is trivially honored on request." },
    rightToCorrect: { value: true, confidence: 0.9, sourceQuote: "Email us and we will correct any data we hold about you." },
    rightToOptOut: { value: true, confidence: 1, sourceQuote: "Use a content blocker or browser signals to opt out of analytics." },
  },
  signalHonoring: {
    honorsBrowserPrivacySignals: "yes",
    gpcDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Global Privacy Control by default." },
    dntDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Do Not Track by default." },
  },
  security: {
    encryptedInTransit: { value: true, confidence: 1, sourceQuote: "All traffic served over HTTPS/TLS." },
    encryptedAtRest: { value: true, confidence: 0.7, sourceQuote: "Railway encrypts persistent volumes at rest." },
    mfaAvailable: { value: false, confidence: 1, sourceQuote: "No user accounts exist on this site." },
    breachNotification: {
      value: true,
      confidence: 0.7,
      sourceQuote: "We will post a notice on this page within a reasonable period after discovering any breach.",
    },
    additionalMeasures: [],
  },
  supplementary: {
    independentAudits: { value: false, confidence: 1, sourceQuote: "No independent audits conducted." },
  },
};

function main() {
  const rubric = loadRubricOrThrow(join(process.cwd(), "src/core/scoring/rubric.v2.yaml"));
  const grade = score(SELF_DATA, rubric);

  const company = upsertCompany("privacy-panel", "Privacy Panel", "privacypanel.org");
  console.log(`Upserted company: ${company.name} (id=${company.id})`);

  const db = getDb();

  // Ensure a policy row exists for this company
  const existingPolicy = db
    .prepare("SELECT id FROM policies WHERE company_id = ? LIMIT 1")
    .get(company.id) as { id: number } | null;

  let policyId: number;
  if (existingPolicy) {
    policyId = existingPolicy.id;
  } else {
    const result = db
      .prepare(
        "INSERT INTO policies (company_id, url, content_hash, fetched_at) VALUES (?, ?, ?, ?)"
      )
      .run(
        company.id,
        "https://privacypanel.org/privacy",
        "0000000000000000000000000000000000000000000000000000000000000000",
        new Date().toISOString()
      );
    policyId = result.lastInsertRowid as number;
  }

  // Remove stale extraction for this company (idempotent)
  db.prepare("DELETE FROM extractions WHERE company_id = ?").run(company.id);

  db.prepare(
    `INSERT INTO extractions
      (policy_id, company_id, facts_json, score, letter, grade_label, grade_color,
       rubric_version, breakdown_json, model, input_tokens, output_tokens, latency_ms, chunked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    policyId,
    company.id,
    JSON.stringify(SELF_DATA),
    grade.score,
    grade.letter,
    grade.label,
    grade.color,
    grade.rubricVersion,
    JSON.stringify(grade.breakdown),
    "handcrafted",
    null,
    null,
    null,
    0
  );

  console.log(`Inserted extraction: ${grade.letter} (${grade.score}/100)`);
  console.log("Done. Privacy Panel now appears in the directory.");
}

main();
