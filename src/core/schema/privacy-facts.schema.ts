import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0";

// ─── Reusable primitives ──────────────────────────────────────────────────────

/** A boolean determination with supporting evidence and confidence. */
const BooleanPractice = z.object({
  value: z.boolean(),
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

const DataSharingSchema = z.object({
  soldToThirdParties: BooleanPractice,
  sharedForAdvertising: BooleanPractice,
  crossSiteTracking: BooleanPractice,
  usedForProfiling: BooleanPractice,
  usedToTrainAI: BooleanPractice,
  /**
   * Number of named third parties disclosed in the policy.
   * null = policy does not disclose a count.
   */
  thirdPartyCount: z.number().int().min(0).nullable(),
});

const DataCollectionSchema = z.object({
  items: z.array(DataItem),
  collectsPreciseGeolocation: BooleanPractice,
  collectsBiometricData: BooleanPractice,
  collectsHealthData: BooleanPractice,
  collectsFinancialData: BooleanPractice,
});

/**
 * Data retention policy.
 * retentionDays: null = indefinite or not specified.
 */
const RetentionSchema = z.object({
  retentionDays: z.number().int().positive().nullable(),
  indefinite: z.boolean(),
  sourceQuote: z.string(),
});

const ConsumerRightsSchema = z.object({
  rightToAccess: BooleanPractice,
  rightToDelete: BooleanPractice,
  rightToPortability: BooleanPractice,
  rightToCorrect: BooleanPractice,
  rightToOptOut: BooleanPractice,
  rightToNonDiscrimination: BooleanPractice,
});

const SignalHonoringSchema = z.object({
  honorsGPC: BooleanPractice,
  honorsDNT: BooleanPractice,
});

const SecuritySchema = z.object({
  /** Free-form list of named security measures (e.g. "TLS", "AES-256 at rest"). */
  measures: z.array(
    z.object({
      name: z.string().min(1),
      sourceQuote: z.string(),
    })
  ),
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
  retention: RetentionSchema,
  consumerRights: ConsumerRightsSchema,
  signalHonoring: SignalHonoringSchema,
  security: SecuritySchema,
});

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
