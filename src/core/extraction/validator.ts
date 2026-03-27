import { validate, SCHEMA_VERSION } from "../schema/privacy-facts.schema";
import type { PrivacyFacts } from "../schema/types";

export interface ValidationSuccess {
  success: true;
  data: PrivacyFacts;
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

// ─── v1 → v2 migration ────────────────────────────────────────────────────────

/**
 * Best-effort migration from v1 to v2 PrivacyFacts format.
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
  data: PrivacyFacts;
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
    "security (structured fields)",
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

  // Migrate security measures (free-form → additionalMeasures, structured fields all null)
  const oldMeasures = (sec["measures"] as { name: string; sourceQuote: string }[] | undefined) ?? [];

  const v2: PrivacyFacts = {
    metadata: {
      ...(meta as { schemaVersion: string; companyName: string; policyUrl: string; analyzedAt: string; policyHash: string }),
      schemaVersion: SCHEMA_VERSION,
    },
    dataCollection: {
      items: (dc["items"] as { name: string; sensitive: boolean; sourceQuote: string }[]) ?? [],
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
      encryptedInTransit: bpNull(),
      encryptedAtRest: bpNull(),
      mfaAvailable: bpNull(),
      breachNotification: bpNull(),
      additionalMeasures: oldMeasures,
    },
    supplementary: {
      independentAudits: bpNull(),
    },
  };

  return { success: true, data: v2, needsReExtraction };
}
