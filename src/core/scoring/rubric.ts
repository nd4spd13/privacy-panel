import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { z } from "zod";

// ─── Shared schemas ───────────────────────────────────────────────────────────

const GradeEntrySchema = z.object({
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  label: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

// ─── v1 Rubric schema ─────────────────────────────────────────────────────────

const V1DeductionEntrySchema = z.object({
  points: z.number().positive(),
  label: z.string(),
});

const V1BonusEntrySchema = z.object({
  pointsEach: z.number().positive(),
  maxCount: z.number().int().positive(),
  label: z.string(),
});

export const V1RubricSchema = z.object({
  version: z.literal("1"),
  startScore: z.number(),
  deductions: z.object({
    soldToThirdParties: V1DeductionEntrySchema,
    sharedForAdvertising: V1DeductionEntrySchema,
    crossSiteTracking: V1DeductionEntrySchema,
    usedForProfiling: V1DeductionEntrySchema,
    usedToTrainAI: V1DeductionEntrySchema,
    collectsPreciseGeolocation: V1DeductionEntrySchema,
    collectsBiometricData: V1DeductionEntrySchema,
    collectsHealthData: V1DeductionEntrySchema,
    collectsFinancialData: V1DeductionEntrySchema,
    doesNotHonorGPC: V1DeductionEntrySchema,
    doesNotHonorDNT: V1DeductionEntrySchema,
    thirdPartiesOver10: V1DeductionEntrySchema,
    thirdParties6To10: V1DeductionEntrySchema,
    retentionIndefinite: V1DeductionEntrySchema,
    retentionOver3Years: V1DeductionEntrySchema,
    retentionOver1Year: V1DeductionEntrySchema,
  }),
  bonuses: z.object({
    perConsumerRight: V1BonusEntrySchema,
    perSecurityMeasure: V1BonusEntrySchema,
  }),
  grades: z.object({
    A: GradeEntrySchema,
    B: GradeEntrySchema,
    C: GradeEntrySchema,
    D: GradeEntrySchema,
    F: GradeEntrySchema,
  }),
});

// ─── v2 Rubric schema ─────────────────────────────────────────────────────────

const NullBehavior = z.enum(["full", "half", "skip"]);
const Tier = z.enum(["core", "emerging", "aspirational"]);

const V2DeductionEntrySchema = z.object({
  points: z.number().positive(),
  tier: Tier,
  nullBehavior: NullBehavior,
  label: z.string(),
});

/** Per-item bonus (e.g. per right, per security measure) */
const V2PerItemBonusSchema = z.object({
  pointsEach: z.number().positive(),
  maxCount: z.number().int().positive(),
  label: z.string(),
});

/** Single bonus (e.g. honors browser signals, AI opt-out) */
const V2SingleBonusSchema = z.object({
  points: z.number().positive(),
  label: z.string(),
});

const V2TierEntrySchema = z.object({
  weight: z.number().min(0).max(1),
  description: z.string(),
});

export const V2RubricSchema = z.object({
  version: z.literal("2"),
  startScore: z.number(),
  tiers: z.object({
    core: V2TierEntrySchema,
    emerging: V2TierEntrySchema,
    aspirational: V2TierEntrySchema,
  }),
  deductions: z.object({
    soldToThirdParties: V2DeductionEntrySchema,
    sharedForAdvertising: V2DeductionEntrySchema,
    usedForProfiling: V2DeductionEntrySchema,
    collectsPreciseGeolocation: V2DeductionEntrySchema,
    collectsBiometricData: V2DeductionEntrySchema,
    collectsHealthData: V2DeductionEntrySchema,
    collectsFinancialData: V2DeductionEntrySchema,
    disclosedToLawEnforcement: V2DeductionEntrySchema,
    thirdPartyCategoriesOver5: V2DeductionEntrySchema,
    thirdPartyCategories3To5: V2DeductionEntrySchema,
    thirdPartyIncludesAdvertising: V2DeductionEntrySchema,
    retentionIndefinite: V2DeductionEntrySchema,
    retentionNotStated: V2DeductionEntrySchema,
    retentionOver3Years: V2DeductionEntrySchema,
    crossSiteTracking: V2DeductionEntrySchema,
    doesNotHonorBrowserPrivacySignals: V2DeductionEntrySchema,
    usedToTrainAI: V2DeductionEntrySchema,
  }),
  bonuses: z.object({
    perConsumerRight: V2PerItemBonusSchema,
    perSecurityMeasure: V2PerItemBonusSchema,
    honorsBrowserSignals: V2SingleBonusSchema,
    aiTrainingOptOut: V2SingleBonusSchema,
    independentAudits: V2SingleBonusSchema,
  }),
  grades: z.object({
    A: GradeEntrySchema,
    B: GradeEntrySchema,
    C: GradeEntrySchema,
    D: GradeEntrySchema,
    F: GradeEntrySchema,
  }),
});

// ─── Combined Rubric type ─────────────────────────────────────────────────────

export type V1Rubric = z.infer<typeof V1RubricSchema>;
export type V2Rubric = z.infer<typeof V2RubricSchema>;
export type Rubric = V1Rubric | V2Rubric;
export type GradeLetter = "A" | "B" | "C" | "D" | "F";

// Keep the legacy RubricSchema export so existing call sites compile
export const RubricSchema = V1RubricSchema;

// ─── Loader ───────────────────────────────────────────────────────────────────

type LoadSuccess = { success: true; rubric: Rubric };
type LoadFailure = { success: false; error: string };

export function loadRubric(filePath?: string): LoadSuccess | LoadFailure {
  const path = filePath ?? join(__dirname, "rubric.v1.yaml");

  let raw: unknown;
  try {
    const content = readFileSync(path, "utf-8");
    raw = yaml.load(content);
  } catch (err) {
    return {
      success: false,
      error: `Failed to read rubric file: ${(err as Error).message}`,
    };
  }

  // Try v2 first, then fall back to v1
  const v2 = V2RubricSchema.safeParse(raw);
  if (v2.success) return { success: true, rubric: v2.data };

  const v1 = V1RubricSchema.safeParse(raw);
  if (v1.success) return { success: true, rubric: v1.data };

  return {
    success: false,
    error: `Invalid rubric (tried v2 and v1): ${v2.error.message}`,
  };
}

/** Convenience: load rubric or throw. Use only at startup/test time. */
export function loadRubricOrThrow(filePath?: string): Rubric {
  const result = loadRubric(filePath);
  if (!result.success) throw new Error(result.error);
  return result.rubric;
}

/** Type guard helpers */
export function isV2Rubric(rubric: Rubric): rubric is V2Rubric {
  return rubric.version === "2";
}

export function isV1Rubric(rubric: Rubric): rubric is V1Rubric {
  return rubric.version === "1";
}
