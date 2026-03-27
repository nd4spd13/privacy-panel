import { z } from "zod";

export const SCHEMA_VERSION = "2.0.0";

// ─── Reusable primitives ──────────────────────────────────────────────────────

/**
 * A boolean determination with supporting evidence and confidence.
 * value === null means the policy does not address this topic at all.
 */
const BooleanPractice = z.object({
  value: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  sourceQuote: z.string(),
});

/** A data type collected, with sensitivity flag and supporting evidence. */
const DataItem = z.object({
  name: z.string().min(1),
  sensitive: z.boolean(),
  sourceQuote: z.string(),
});

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Structured third-party recipients information replacing the legacy thirdPartyCount number.
 */
const ThirdPartyRecipientsSchema = z.object({
  categoryCount: z.number().int().min(0).nullable(),
  categories: z.array(z.string()),
  includesAdvertising: z.boolean(),
  includesLawEnforcement: z.boolean(),
  sourceQuote: z.string(),
});

const DataSharingSchema = z.object({
  soldToThirdParties: BooleanPractice,
  sharedForAdvertising: BooleanPractice,
  crossSiteTracking: BooleanPractice,
  usedForProfiling: BooleanPractice,
  usedToTrainAI: BooleanPractice,
  disclosedToLawEnforcement: BooleanPractice,
});

/** 10 standardized purpose checkboxes extracted from policy text. */
const PurposesSchema = z.object({
  provideCoreService: BooleanPractice,
  securityFraudPrevention: BooleanPractice,
  legalRegulatoryCompliance: BooleanPractice,
  advertisingMarketing: BooleanPractice,
  personalization: BooleanPractice,
  analyticsResearch: BooleanPractice,
  serviceImprovement: BooleanPractice,
  paymentProcessing: BooleanPractice,
  aiMlTraining: BooleanPractice,
  thirdPartyDataPartnerships: BooleanPractice,
  other: z.object({
    value: z.boolean().nullable(),
    description: z.string().nullable(),
    sourceQuote: z.string(),
  }),
});

/**
 * Standardized taxonomy of sensitive data categories.
 * Each field is a boolean indicating whether the policy discloses collection of that category.
 */
const SensitiveTaxonomySchema = z.object({
  preciseGeolocation: z.boolean(),
  financialPaymentData: z.boolean(),
  governmentIds: z.boolean(),
  biometricIdentifiers: z.boolean(),
  healthData: z.boolean(),
  geneticData: z.boolean(),
  sexualOrientationGenderIdentity: z.boolean(),
  racialEthnicOrigin: z.boolean(),
  communicationsContent: z.boolean(),
  childrensData: z.boolean(),
});

const DataCollectionSchema = z.object({
  items: z.array(DataItem),
  sensitiveTaxonomy: SensitiveTaxonomySchema,
  // Legacy boolean flags kept for backward compatibility — they now reflect sensitiveTaxonomy
  collectsPreciseGeolocation: BooleanPractice,
  collectsBiometricData: BooleanPractice,
  collectsHealthData: BooleanPractice,
  collectsFinancialData: BooleanPractice,
});

/**
 * Structured retention policy replacing legacy retentionDays/indefinite.
 * longestStatedPeriod is a human-readable string (e.g. "3 years", "indefinitely", "not stated").
 */
const RetentionSchema = z.object({
  longestStatedPeriod: z.string(),
  variesByDataType: z.boolean(),
  legallyMandatedRetention: z.boolean(),
  summary: z.string(),
  sourceQuote: z.string(),
});

const ConsumerRightsSchema = z.object({
  rightToAccess: BooleanPractice,
  rightToDelete: BooleanPractice,
  rightToPortability: BooleanPractice,
  rightToCorrect: BooleanPractice,
  rightToOptOut: BooleanPractice,
  // rightToNonDiscrimination removed in v2 — unreliable in practice
});

/**
 * Browser privacy signal honoring.
 * honorsBrowserPrivacySignals: "yes" | "partial" | "no" | null (not addressed).
 */
const SignalHonoringSchema = z.object({
  honorsBrowserPrivacySignals: z.enum(["yes", "partial", "no"]).nullable(),
  gpcDetail: BooleanPractice,
  dntDetail: BooleanPractice,
});

const SecuritySchema = z.object({
  encryptedInTransit: BooleanPractice,
  encryptedAtRest: BooleanPractice,
  mfaAvailable: BooleanPractice,
  breachNotification: BooleanPractice,
  /** Free-form additional security measures beyond the 4 structured fields. */
  additionalMeasures: z.array(
    z.object({
      name: z.string().min(1),
      sourceQuote: z.string(),
    })
  ),
});

const SupplementarySchema = z.object({
  independentAudits: BooleanPractice,
});

const MetadataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  companyName: z.string().min(1),
  policyUrl: z.string().url(),
  /** ISO-8601 date string when the policy was fetched/analyzed. */
  analyzedAt: z.string().datetime(),
  /** SHA-256 hex digest of the raw policy text. */
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** Optional: the date printed in the policy itself. */
  policyEffectiveDate: z.string().nullable().optional(),
});

// ─── Root schema ─────────────────────────────────────────────────────────────

export const PrivacyFactsSchema = z.object({
  metadata: MetadataSchema,
  dataCollection: DataCollectionSchema,
  dataSharing: DataSharingSchema,
  thirdPartyRecipients: ThirdPartyRecipientsSchema,
  purposes: PurposesSchema,
  retention: RetentionSchema,
  consumerRights: ConsumerRightsSchema,
  signalHonoring: SignalHonoringSchema,
  security: SecuritySchema,
  supplementary: SupplementarySchema,
});

// ─── Exported sub-schemas (for use in migration/validation) ──────────────────

export { ThirdPartyRecipientsSchema, SensitiveTaxonomySchema, RetentionSchema, SignalHonoringSchema };

// ─── Validation helper ────────────────────────────────────────────────────────

type ValidationSuccess = { success: true; data: z.infer<typeof PrivacyFactsSchema> };
type ValidationFailure = {
  success: false;
  error: z.ZodError;
  issues: z.ZodIssue[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validate(input: unknown): ValidationResult {
  const result = PrivacyFactsSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error, issues: result.error.issues };
}
