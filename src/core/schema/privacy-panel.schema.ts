import { z } from "zod";

export const SCHEMA_VERSION = "2.1.0";

/** Previous schema versions still accepted by the validator. */
export const LEGACY_SCHEMA_VERSIONS = ["2.0.0"] as const;

// ─── Data Category Taxonomy ───────────────────────────────────────────────────

/**
 * Standardized data-category taxonomy for Privacy Panel labels.
 * Derived from CCPA/CPRA, GDPR Art.4/9, VCDPA, CPA, CTDPA, COPPA,
 * Apple App Privacy Labels, and Google Play Data Safety.
 *
 * 17 categories: 9 sensitive, 8 non-sensitive.
 */
export const DATA_CATEGORIES = [
  // Non-sensitive
  "contact_info",
  "identifiers",
  "purchase_history",
  "browsing_activity",
  "usage_analytics",
  "contacts_address_book",
  "photos_videos_audio",
  "employment_education",
  // Sensitive
  "financial_info",
  "precise_location",
  "health_fitness",
  "biometric_data",
  "genetic_data",
  "government_ids",
  "demographic_protected",
  "communications_content",
  "childrens_data",
] as const;

export type DataCategory = typeof DATA_CATEGORIES[number];

const DataCategoryEnum = z.enum(DATA_CATEGORIES);

/** Categories that are always considered sensitive. */
export const SENSITIVE_CATEGORIES: ReadonlySet<DataCategory> = new Set([
  "financial_info",
  "precise_location",
  "health_fitness",
  "biometric_data",
  "genetic_data",
  "government_ids",
  "demographic_protected",
  "communications_content",
  "childrens_data",
]);

/** Consumer-friendly display labels for each category. */
export const CATEGORY_LABELS: Record<DataCategory, string> = {
  contact_info: "Contact Info",
  identifiers: "Device & Online IDs",
  purchase_history: "Purchases & Transactions",
  browsing_activity: "Browsing & Search History",
  usage_analytics: "App Usage & Diagnostics",
  contacts_address_book: "Contacts / Address Book",
  photos_videos_audio: "Photos, Videos & Audio",
  employment_education: "Employment & Education",
  financial_info: "Financial & Payment Data",
  precise_location: "Precise Location",
  health_fitness: "Health & Fitness",
  biometric_data: "Biometric Data",
  genetic_data: "Genetic Data",
  government_ids: "Government IDs",
  demographic_protected: "Race, Religion & Demographics",
  communications_content: "Message & Email Content",
  childrens_data: "Children's Data",
};

// ─── Quote provenance primitives ─────────────────────────────────────────────

/**
 * Classifies the relationship between a sourceQuote and the actual policy text.
 *
 * - verbatim  — sourceQuote is a near-direct excerpt from the policy
 * - inferred  — sourceQuote is the model's reasoning about what the policy implies
 * - silence   — the policy does not address this topic; sourceQuote describes the absence
 *
 * Optional for backward compatibility: absent on v2.0 extractions.
 * When present, the app uses this instead of the regex heuristic.
 */
export const QuoteTypeSchema = z.enum(["verbatim", "inferred", "silence"]);
export type QuoteType = z.infer<typeof QuoteTypeSchema>;

/**
 * Anchors a verbatim quote to a specific location in the normalized policy text.
 * Only populated when quoteType === "verbatim".
 *
 * Uses a dual W3C Web Annotation selector:
 *   - position: character offsets into the normalized text (fast path)
 *   - quote:    TextQuoteSelector (robust fallback if offsets drift)
 *
 * policyTextHash is the SHA-256 of the *normalized* policy text (norm-v1),
 * tying these coordinates to a specific document version.
 */
export const SourceAnchorSchema = z.object({
  /** SHA-256 of the normalized policy text — defines the coordinate system. */
  policyTextHash: z.string(),
  /** Versioned normalization function applied before hashing. */
  normalizer: z.string(),
  /** Character offsets into the normalized text — fast path. */
  position: z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  }),
  /** W3C TextQuoteSelector — robust re-location if offsets drift. */
  quote: z.object({
    exact: z.string(),
    prefix: z.string(),
    suffix: z.string(),
  }),
  /** Optional SHA-256 of `exact` — proves the excerpt verbatim on its own. */
  quoteHash: z.string().optional(),
});
export type SourceAnchor = z.infer<typeof SourceAnchorSchema>;

// ─── Reusable primitives ──────────────────────────────────────────────────────

/**
 * A boolean determination with supporting evidence and confidence.
 * value === null means the policy does not address this topic at all.
 *
 * quoteType (v2.1+): classifies sourceQuote as verbatim / inferred / silence.
 * sourceAnchor (v2.1+): locates a verbatim quote in the policy text (verbatim only).
 */
const BooleanPractice = z.object({
  value: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  sourceQuote: z.string(),
  quoteType: QuoteTypeSchema.optional(),
  sourceAnchor: SourceAnchorSchema.optional(),
});

/** A data type collected, classified into a standardized category. */
const DataItem = z.object({
  category: DataCategoryEnum,
  name: z.string().min(1),
  sensitive: z.boolean(),
  sourceQuote: z.string(),
  quoteType: QuoteTypeSchema.optional(),
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
  schemaVersion: z.union([
    z.literal(SCHEMA_VERSION),
    ...LEGACY_SCHEMA_VERSIONS.map(v => z.literal(v)),
  ]),
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

export const PrivacyPanelSchema = z.object({
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

type ValidationSuccess = { success: true; data: z.infer<typeof PrivacyPanelSchema> };
type ValidationFailure = {
  success: false;
  error: z.ZodError;
  issues: z.ZodIssue[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validate(input: unknown): ValidationResult {
  const result = PrivacyPanelSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error, issues: result.error.issues };
}
