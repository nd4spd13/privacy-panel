import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { z } from "zod";

// ─── Zod schema for the rubric YAML ──────────────────────────────────────────

const DeductionEntrySchema = z.object({
  points: z.number().positive(),
  label: z.string(),
});

const BonusEntrySchema = z.object({
  pointsEach: z.number().positive(),
  maxCount: z.number().int().positive(),
  label: z.string(),
});

const GradeEntrySchema = z.object({
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  label: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const RubricSchema = z.object({
  version: z.string(),
  startScore: z.number(),
  deductions: z.object({
    soldToThirdParties: DeductionEntrySchema,
    sharedForAdvertising: DeductionEntrySchema,
    crossSiteTracking: DeductionEntrySchema,
    usedForProfiling: DeductionEntrySchema,
    usedToTrainAI: DeductionEntrySchema,
    collectsPreciseGeolocation: DeductionEntrySchema,
    collectsBiometricData: DeductionEntrySchema,
    collectsHealthData: DeductionEntrySchema,
    collectsFinancialData: DeductionEntrySchema,
    doesNotHonorGPC: DeductionEntrySchema,
    doesNotHonorDNT: DeductionEntrySchema,
    thirdPartiesOver10: DeductionEntrySchema,
    thirdParties6To10: DeductionEntrySchema,
    retentionIndefinite: DeductionEntrySchema,
    retentionOver3Years: DeductionEntrySchema,
    retentionOver1Year: DeductionEntrySchema,
  }),
  bonuses: z.object({
    perConsumerRight: BonusEntrySchema,
    perSecurityMeasure: BonusEntrySchema,
  }),
  grades: z.object({
    A: GradeEntrySchema,
    B: GradeEntrySchema,
    C: GradeEntrySchema,
    D: GradeEntrySchema,
    F: GradeEntrySchema,
  }),
});

export type Rubric = z.infer<typeof RubricSchema>;
export type GradeLetter = "A" | "B" | "C" | "D" | "F";

// ─── Loader ───────────────────────────────────────────────────────────────────

type LoadSuccess = { success: true; rubric: Rubric };
type LoadFailure = { success: false; error: string };

export function loadRubric(filePath?: string): LoadSuccess | LoadFailure {
  const path =
    filePath ?? join(__dirname, "rubric.v1.yaml");

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

  const result = RubricSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: `Invalid rubric: ${result.error.message}`,
    };
  }

  return { success: true, rubric: result.data };
}

/** Convenience: load rubric or throw. Use only at startup/test time. */
export function loadRubricOrThrow(filePath?: string): Rubric {
  const result = loadRubric(filePath);
  if (!result.success) throw new Error(result.error);
  return result.rubric;
}
