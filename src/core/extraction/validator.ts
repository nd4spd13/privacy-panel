import { validate, SCHEMA_VERSION, SENSITIVE_CATEGORIES } from "../schema/privacy-panel.schema";
import type { PrivacyPanel } from "../schema/types";
import type { DataCategory } from "../schema/privacy-panel.schema";

export interface ValidationSuccess {
  success: true;
  data: PrivacyPanel;
}

export interface ValidationFailure {
  success: false;
  error: string;
  rawOutput: string;
}

export type ExtractionValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Parse and validate the raw string output from Claude.
 * Handles common LLM output artefacts (leading/trailing whitespace, code fences).
 */
export function validateExtractionOutput(
  rawOutput: string
): ExtractionValidationResult {
  const cleaned = stripCodeFences(rawOutput.trim());

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${(err as Error).message}`,
      rawOutput,
    };
  }

  const result = validate(parsed);
  if (!result.success) {
    const issues = result.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: `Schema validation failed: ${issues}`,
      rawOutput,
    };
  }

  // Ensure schemaVersion matches — belt-and-suspenders beyond the z.literal() check
  if (result.data.metadata.schemaVersion !== SCHEMA_VERSION) {
    return {
      success: false,
      error: `Unexpected schemaVersion: got ${result.data.metadata.schemaVersion}, expected ${SCHEMA_VERSION}`,
      rawOutput,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Strip markdown code fences that some LLMs emit even when instructed not to.
 * Handles ```json ... ```, ``` ... ```, and bare content.
 */
function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text;
}

// ─── Data category classifier (best-effort for v1 items) ─────────────────────

const CATEGORY_KEYWORDS: [DataCategory, RegExp][] = [
  // Sensitive categories first (more specific patterns)
  ["government_ids", /\b(ssn|social security|passport|driver'?s? licen[cs]e?|national id|tax id|government.?id|identification documents?|identity verification)\b/i],
  ["biometric_data", /\b(biometric|fingerprint|face geometry|facial geometry|face recognition|voiceprint|retina|iris scan|faceprint)\b/i],
  ["genetic_data", /\b(genetic|dna|genom)/i],
  ["health_fitness", /\b(health|medical|fitness|prescription|diagnos|menstrual|mental health|physical condition|bmi|heart rate|step count)\b/i],
  ["financial_info", /\b(payment|credit card|debit card|bank account|financial|credit score|income|billing|payment card|account numbers?|routing number|password|credentials?)\b/i],
  ["precise_location", /\b(gps|precise location|exact location|real-?time location|geolocation|location data)\b/i],
  ["demographic_protected", /\b(race|racial|ethnic|religion|religious|political|sexual orientation|gender identity|disability|union membership|citizenship|immigration)\b/i],
  ["communications_content", /\b(email content|message content|chat content|text message|sms content|voicemail|private message|direct message)\b/i],
  ["childrens_data", /\b(child(ren)?'?s? data|minor'?s? data|coppa|under 13|under 16)\b/i],
  // Non-sensitive categories (ordered from specific to general)
  ["photos_videos_audio", /\b(photos?|videos?|audio|images?|voice recording|camera|user.?content|user.?generated content|listing.*(descriptions?|photos?|images?)|livestreams?)\b/i],
  ["contacts_address_book", /\b(address book|contact list|phone contacts|contacts you import)\b/i],
  ["browsing_activity", /\b(browsing|search histor(y|ies)|cookies?|tracking data|web.?beac|pixel|page.?views?|referr)\b/i],
  ["usage_analytics", /\b(crash|diagnostic|analytics|app.?usage|feature usage|session|telemetry|performance data|log data|device data)\b/i],
  ["purchase_history", /\b(purchase|transaction|order histor|shopping|commercial)\b/i],
  ["employment_education", /\b(employ|job title|occupation|profession|education|school|university|degree|student)\b/i],
  ["identifiers", /\b(device id|user.?id|advertis.* id|ip address|account info(rmation)?|username|unique id|online id|cookie id|identifiers?|device|social media accounts?)\b/i],
  ["contact_info", /\b(^name$|email.?address|phone.?number|mailing.?address|postal|contact info(rmation)?|shipping address)\b/i],
];

/** Classify a free-text data item name into the best-matching category. */
export function classifyDataItem(name: string): DataCategory {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category;
  }
  return "contact_info"; // fallback for unclassifiable items
}

// ─── v1 → v2 migration ────────────────────────────────────────────────────────

/**
 * Best-effort migration from v1 to v2 PrivacyPanel format.
 *
 * v1 shape uses:
 *   - schemaVersion: "1.0.0"
 *   - dataSharing.thirdPartyCount (number|null) → thirdPartyRecipients
 *   - retention.retentionDays / indefinite → longestStatedPeriod etc.
 *   - signalHonoring.honorsGPC / honorsDNT → honorsBrowserPrivacySignals
 *   - consumerRights.rightToNonDiscrimination → dropped
 *   - security.measures[] (free-form) → structured fields (all null) + additionalMeasures
 *   - no: purposes, sensitiveTaxonomy, supplementary, disclosedToLawEnforcement
 *
 * New v2-only fields default to null/empty and are flagged via `needsReExtraction`.
 */
export interface MigrationResult {
  success: true;
  data: PrivacyPanel;
  /** Fields that could not be migrated and need re-extraction. */
  needsReExtraction: string[];
}

export function migrateV1ToV2(v1Raw: unknown): MigrationResult | { success: false; error: string } {
  if (typeof v1Raw !== "object" || v1Raw === null) {
    return { success: false, error: "Input is not an object" };
  }

  const v1 = v1Raw as Record<string, unknown>;
  const meta = v1["metadata"] as Record<string, unknown> | undefined;
  const dc = v1["dataCollection"] as Record<string, unknown> | undefined;
  const ds = v1["dataSharing"] as Record<string, unknown> | undefined;
  const ret = v1["retention"] as Record<string, unknown> | undefined;
  const cr = v1["consumerRights"] as Record<string, unknown> | undefined;
  const sh = v1["signalHonoring"] as Record<string, unknown> | undefined;
  const sec = v1["security"] as Record<string, unknown> | undefined;

  if (!meta || !dc || !ds || !ret || !cr || !sh || !sec) {
    return { success: false, error: "v1 object missing required top-level sections" };
  }

  const needsReExtraction: string[] = [
    "purposes",
    "thirdPartyRecipients.categories",
    "thirdPartyRecipients.includesLawEnforcement",
    "dataSharing.disclosedToLawEnforcement",
    "supplementary",
    "dataCollection.sensitiveTaxonomy",
  ];

  const bpNull = () => ({ value: null as null, confidence: 0.1, sourceQuote: "Not available — requires re-extraction." });
  const bpFromV1 = (field: unknown) => {
    if (typeof field === "object" && field !== null) {
      const f = field as Record<string, unknown>;
      return {
        value: typeof f["value"] === "boolean" ? f["value"] : null,
        confidence: typeof f["confidence"] === "number" ? f["confidence"] : 0.3,
        sourceQuote: typeof f["sourceQuote"] === "string" ? f["sourceQuote"] : "",
      };
    }
    return bpNull();
  };

  // Migrate retention
  const retDays = ret["retentionDays"] as number | null | undefined;
  const retIndefinite = ret["indefinite"] as boolean | undefined;
  let longestStatedPeriod = "not stated";
  if (retIndefinite) {
    longestStatedPeriod = "indefinitely";
  } else if (typeof retDays === "number" && retDays > 0) {
    if (retDays >= 365 * 2) {
      longestStatedPeriod = `${Math.round(retDays / 365)} years`;
    } else if (retDays >= 365) {
      longestStatedPeriod = "1 year";
    } else if (retDays >= 30) {
      longestStatedPeriod = `${retDays} days`;
    } else {
      longestStatedPeriod = `${retDays} days`;
    }
  }

  // Migrate signal honoring
  const honorsGPC = (sh["honorsGPC"] as { value: boolean } | undefined)?.value;
  const honorsDNT = (sh["honorsDNT"] as { value: boolean } | undefined)?.value;
  let honorsBrowserPrivacySignals: "yes" | "partial" | "no" | null = null;
  if (honorsGPC === true && honorsDNT === true) {
    honorsBrowserPrivacySignals = "yes";
  } else if (honorsGPC === false && honorsDNT === false) {
    honorsBrowserPrivacySignals = "no";
  } else if (honorsGPC !== undefined || honorsDNT !== undefined) {
    honorsBrowserPrivacySignals = "partial";
  }

  // Migrate third-party count
  const tpCount = ds["thirdPartyCount"] as number | null | undefined;

  // Migrate security measures (free-form → additionalMeasures + best-effort structured mapping)
  const oldMeasures = (sec["measures"] as { name: string; sourceQuote: string }[] | undefined) ?? [];
  const measureNames = oldMeasures.map(m => m.name.toLowerCase());

  const bpInferred = (sourceQuote: string) => ({ value: true as const, confidence: 0.6, sourceQuote });

  const encryptedInTransit = measureNames.some(n =>
    (n.includes("encrypt") && (n.includes("transit") || n.includes("tls") || n.includes("ssl") || n.includes("https")))
    || n.includes("transport layer security") || n.includes("secure socket")
    || n.includes("end-to-end encrypt")
  ) ? bpInferred("Inferred from v1 security measures") : bpNull();

  // "data encryption" or "encryption" alone → assume at-rest (transit is more specific)
  const encryptedAtRest = measureNames.some(n =>
    (n.includes("encrypt") && (n.includes("rest") || n.includes("storage") || n.includes("stored")))
    || n.includes("aes") || n.includes("secure storage")
    || (n.includes("data encrypt") && !n.includes("transit") && !n.includes("end-to-end"))
  ) ? bpInferred("Inferred from v1 security measures") : bpNull();

  const mfaAvailable = measureNames.some(n =>
    n.includes("mfa") || n.includes("multi-factor") || n.includes("two-factor") || n.includes("2fa")
    || n.includes("two-step verification")
  ) ? bpInferred("Inferred from v1 security measures") : bpNull();

  const breachNotification = measureNames.some(n =>
    n.includes("breach") || (n.includes("incident") && n.includes("notif"))
    || n.includes("breach notification")
  ) ? bpInferred("Inferred from v1 security measures") : bpNull();

  const v2: PrivacyPanel = {
    metadata: {
      ...(meta as { schemaVersion: string; companyName: string; policyUrl: string; analyzedAt: string; policyHash: string }),
      schemaVersion: SCHEMA_VERSION,
    },
    dataCollection: {
      items: ((dc["items"] as { name: string; sensitive: boolean; sourceQuote: string }[]) ?? []).map(item => ({
        ...item,
        category: classifyDataItem(item.name),
      })),
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
      collectsPreciseGeolocation: bpFromV1(dc["collectsPreciseGeolocation"]),
      collectsBiometricData: bpFromV1(dc["collectsBiometricData"]),
      collectsHealthData: bpFromV1(dc["collectsHealthData"]),
      collectsFinancialData: bpFromV1(dc["collectsFinancialData"]),
    },
    dataSharing: {
      soldToThirdParties: bpFromV1(ds["soldToThirdParties"]),
      sharedForAdvertising: bpFromV1(ds["sharedForAdvertising"]),
      crossSiteTracking: bpFromV1(ds["crossSiteTracking"]),
      usedForProfiling: bpFromV1(ds["usedForProfiling"]),
      usedToTrainAI: bpFromV1(ds["usedToTrainAI"]),
      disclosedToLawEnforcement: bpNull(),
    },
    thirdPartyRecipients: {
      categoryCount: typeof tpCount === "number" ? tpCount : null,
      categories: [],
      includesAdvertising: false,
      includesLawEnforcement: false,
      sourceQuote: "Migrated from v1 — categories not available.",
    },
    purposes: {
      provideCoreService: bpNull(),
      securityFraudPrevention: bpNull(),
      legalRegulatoryCompliance: bpNull(),
      advertisingMarketing: bpNull(),
      personalization: bpNull(),
      analyticsResearch: bpNull(),
      serviceImprovement: bpNull(),
      paymentProcessing: bpNull(),
      aiMlTraining: bpNull(),
      thirdPartyDataPartnerships: bpNull(),
      other: { value: null, description: null, sourceQuote: "Not available — requires re-extraction." },
    },
    retention: {
      longestStatedPeriod,
      variesByDataType: false,
      legallyMandatedRetention: false,
      summary: `Migrated from v1. ${longestStatedPeriod !== "not stated" ? `Longest period: ${longestStatedPeriod}.` : "Period not stated."}`,
      sourceQuote: typeof ret["sourceQuote"] === "string" ? ret["sourceQuote"] : "",
    },
    consumerRights: {
      rightToAccess: bpFromV1(cr["rightToAccess"]),
      rightToDelete: bpFromV1(cr["rightToDelete"]),
      rightToPortability: bpFromV1(cr["rightToPortability"]),
      rightToCorrect: bpFromV1(cr["rightToCorrect"]),
      rightToOptOut: bpFromV1(cr["rightToOptOut"]),
      // rightToNonDiscrimination dropped
    },
    signalHonoring: {
      honorsBrowserPrivacySignals,
      gpcDetail: bpFromV1(sh["honorsGPC"]),
      dntDetail: bpFromV1(sh["honorsDNT"]),
    },
    security: {
      encryptedInTransit,
      encryptedAtRest,
      mfaAvailable,
      breachNotification,
      additionalMeasures: oldMeasures,
    },
    supplementary: {
      independentAudits: bpNull(),
    },
  };

  return { success: true, data: v2, needsReExtraction };
}
