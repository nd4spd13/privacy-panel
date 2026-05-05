import type { PrivacyPanel } from "../schema/types";
import type { Rubric, V1Rubric, V2Rubric, GradeLetter } from "./rubric";
import { isV2Rubric } from "./rubric";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface BreakdownItem {
  key: string;
  label: string;
  points: number; // negative for deductions, positive for bonuses
  triggered: boolean;
  detail?: string;
}

export interface GradeResult {
  score: number;
  letter: GradeLetter;
  label: string;
  color: string;
  rubricVersion: string;
  breakdown: BreakdownItem[];
}

// ─── Pure scoring function ────────────────────────────────────────────────────

/**
 * Score a PrivacyPanel extraction against a rubric.
 * Supports both v1 (legacy) and v2 rubrics.
 * Pure function — no side effects, no I/O. Same inputs always produce same output.
 */
export function score(extraction: PrivacyPanel, rubric: Rubric): GradeResult {
  if (isV2Rubric(rubric)) {
    return scoreV2(extraction, rubric);
  }
  return scoreV1(extraction as Parameters<typeof scoreV1>[0], rubric);
}

// ─── v2 scoring ───────────────────────────────────────────────────────────────

function scoreV2(extraction: PrivacyPanel, rubric: V2Rubric): GradeResult {
  const breakdown: BreakdownItem[] = [];
  let running = rubric.startScore;

  /**
   * Apply a deduction based on a nullable boolean value.
   * - true → triggered at full weight
   * - false → not triggered
   * - null → apply nullBehavior (full/half/skip)
   */
  function deduct(
    key: string,
    value: boolean | null,
    deductionKey: keyof V2Rubric["deductions"],
    detail?: string
  ): void {
    const entry = rubric.deductions[deductionKey];
    const tierWeight = rubric.tiers[entry.tier].weight;
    const basePoints = entry.points * tierWeight;

    if (value === true) {
      const pts = Math.round(basePoints);
      breakdown.push({ key, label: entry.label, points: -pts, triggered: true, detail });
      running -= pts;
    } else if (value === null) {
      if (entry.nullBehavior === "full") {
        const pts = Math.round(basePoints);
        breakdown.push({ key, label: entry.label, points: -pts, triggered: true, detail: "policy silent — treated as triggered" });
        running -= pts;
      } else if (entry.nullBehavior === "half") {
        const pts = Math.round(basePoints / 2);
        breakdown.push({ key, label: entry.label, points: -pts, triggered: true, detail: "policy silent — half deduction" });
        running -= pts;
      } else {
        // skip
        breakdown.push({ key, label: entry.label, points: 0, triggered: false });
      }
    } else {
      // false
      breakdown.push({ key, label: entry.label, points: 0, triggered: false });
    }
  }

  function deductRaw(
    key: string,
    triggered: boolean,
    deductionKey: keyof V2Rubric["deductions"],
    detail?: string
  ): void {
    const entry = rubric.deductions[deductionKey];
    const tierWeight = rubric.tiers[entry.tier].weight;
    const pts = Math.round(entry.points * tierWeight);
    breakdown.push({ key, label: entry.label, points: triggered ? -pts : 0, triggered, detail });
    if (triggered) running -= pts;
  }

  function bonus(
    key: string,
    triggered: boolean,
    points: number,
    label: string,
    detail?: string
  ): void {
    breakdown.push({ key, label, points: triggered ? points : 0, triggered, detail });
    if (triggered) running += points;
  }

  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security, thirdPartyRecipients, supplementary } =
    extraction;

  // ── Core deductions ─────────────────────────────────────────────────────────

  deduct("soldToThirdParties", dataSharing.soldToThirdParties.value, "soldToThirdParties");
  deduct("sharedForAdvertising", dataSharing.sharedForAdvertising.value, "sharedForAdvertising");
  deduct("usedForProfiling", dataSharing.usedForProfiling.value, "usedForProfiling");
  deduct("collectsPreciseGeolocation", dataCollection.collectsPreciseGeolocation.value, "collectsPreciseGeolocation");
  deduct("collectsBiometricData", dataCollection.collectsBiometricData.value, "collectsBiometricData");
  deduct("collectsHealthData", dataCollection.collectsHealthData.value, "collectsHealthData");
  deduct("collectsFinancialData", dataCollection.collectsFinancialData.value, "collectsFinancialData");
  deduct("disclosedToLawEnforcement", dataSharing.disclosedToLawEnforcement.value, "disclosedToLawEnforcement");

  // ── Emerging tier deductions ────────────────────────────────────────────────

  deduct("crossSiteTracking", dataSharing.crossSiteTracking.value, "crossSiteTracking");

  // Browser signals: deduction only for explicit "no" (null = skip)
  const signalStatus = signalHonoring.honorsBrowserPrivacySignals;
  deductRaw(
    "doesNotHonorBrowserPrivacySignals",
    signalStatus === "no",
    "doesNotHonorBrowserPrivacySignals",
    signalStatus !== null ? undefined : undefined
  );

  // ── Third-party recipient tiers (mutually exclusive) ────────────────────────
  const catCount = thirdPartyRecipients.categoryCount;
  const tpOver5 = catCount !== null && catCount > 5;
  const tp3to5 = catCount !== null && catCount >= 3 && catCount <= 5;

  deductRaw(
    "thirdPartyCategoriesOver5",
    tpOver5,
    "thirdPartyCategoriesOver5",
    catCount !== null ? `${catCount} categories disclosed` : undefined
  );
  deductRaw(
    "thirdPartyCategories3To5",
    !tpOver5 && tp3to5,
    "thirdPartyCategories3To5",
    catCount !== null ? `${catCount} categories disclosed` : undefined
  );
  deductRaw(
    "thirdPartyIncludesAdvertising",
    thirdPartyRecipients.includesAdvertising,
    "thirdPartyIncludesAdvertising"
  );

  // ── Retention logic ─────────────────────────────────────────────────────────
  const retentionResult = scoreRetentionV2(retention);

  deductRaw(
    "retentionIndefinite",
    retentionResult.indefinite,
    "retentionIndefinite"
  );
  deductRaw(
    "retentionNotStated",
    !retentionResult.indefinite && retentionResult.notStated,
    "retentionNotStated"
  );
  deductRaw(
    "retentionOver3Years",
    !retentionResult.indefinite && !retentionResult.notStated && retentionResult.over3Years && !retention.legallyMandatedRetention,
    "retentionOver3Years",
    retentionResult.periodDetail
  );

  // ── Aspirational tier: usedToTrainAI — no deduction, only bonus ────────────
  // (recorded as 0-points entry so it appears in the breakdown)
  breakdown.push({
    key: "usedToTrainAI",
    label: rubric.deductions.usedToTrainAI.label,
    points: 0,
    triggered: dataSharing.usedToTrainAI.value === true,
    detail: dataSharing.usedToTrainAI.value === true ? "aspirational tier — no deduction" : undefined,
  });

  // ── Bonuses ─────────────────────────────────────────────────────────────────

  // Consumer rights: 5 rights in v2 (removed rightToNonDiscrimination); null = 0 bonus
  const rights = [
    consumerRights.rightToAccess.value,
    consumerRights.rightToDelete.value,
    consumerRights.rightToPortability.value,
    consumerRights.rightToCorrect.value,
    consumerRights.rightToOptOut.value,
  ];
  const rightsCount = Math.min(rights.filter((v) => v === true).length, rubric.bonuses.perConsumerRight.maxCount);
  const rightsBonus = rightsCount * rubric.bonuses.perConsumerRight.pointsEach;
  bonus(
    "consumerRights",
    rightsBonus > 0,
    rightsBonus,
    rubric.bonuses.perConsumerRight.label,
    `${rightsCount} of ${rubric.bonuses.perConsumerRight.maxCount} rights offered`
  );

  // Security: 4 structured measures; null = 0 bonus
  const secMeasures = [
    security.encryptedInTransit.value,
    security.encryptedAtRest.value,
    security.mfaAvailable.value,
    security.breachNotification.value,
  ];
  const measuresCount = Math.min(
    secMeasures.filter((v) => v === true).length,
    rubric.bonuses.perSecurityMeasure.maxCount
  );
  const secBonus = measuresCount * rubric.bonuses.perSecurityMeasure.pointsEach;
  bonus(
    "securityMeasures",
    secBonus > 0,
    secBonus,
    rubric.bonuses.perSecurityMeasure.label,
    `${measuresCount} of ${rubric.bonuses.perSecurityMeasure.maxCount} measures`
  );

  // Browser signals bonus: "yes" or "partial"
  bonus(
    "honorsBrowserSignals",
    signalStatus === "yes" || signalStatus === "partial",
    rubric.bonuses.honorsBrowserSignals.points,
    rubric.bonuses.honorsBrowserSignals.label,
    signalStatus !== null ? `Status: ${signalStatus}` : undefined
  );

  // AI training opt-out bonus: explicit false (not null)
  bonus(
    "aiTrainingOptOut",
    dataSharing.usedToTrainAI.value === false,
    rubric.bonuses.aiTrainingOptOut.points,
    rubric.bonuses.aiTrainingOptOut.label
  );

  // Independent audits bonus
  bonus(
    "independentAudits",
    supplementary.independentAudits.value === true,
    rubric.bonuses.independentAudits.points,
    rubric.bonuses.independentAudits.label
  );

  // ── Clamp & grade ──────────────────────────────────────────────────────────

  const finalScore = Math.max(0, Math.min(100, running));
  const { letter, gradeLabel, color } = resolveGrade(finalScore, rubric);

  return {
    score: finalScore,
    letter,
    label: gradeLabel,
    color,
    rubricVersion: rubric.version,
    breakdown,
  };
}

// ─── Retention parsing ────────────────────────────────────────────────────────

interface RetentionAnalysis {
  indefinite: boolean;
  notStated: boolean;
  over3Years: boolean;
  periodDetail?: string;
}

/**
 * Parse a human-readable retention period string into scoreable flags.
 * Examples: "3 years", "indefinitely", "not stated", "90 days", "7 years"
 */
function scoreRetentionV2(retention: PrivacyPanel["retention"]): RetentionAnalysis {
  const period = retention.longestStatedPeriod.trim().toLowerCase();

  // Explicit indefinite markers
  const indefiniteMarkers = ["indefinitely", "indefinite", "as long as necessary", "no fixed period", "no set period", "perpetually"];
  if (indefiniteMarkers.some((m) => period.includes(m))) {
    return { indefinite: true, notStated: false, over3Years: false };
  }

  // Not stated
  const notStatedMarkers = ["not stated", "not disclosed", "not specified", "unspecified", "unknown", ""];
  if (notStatedMarkers.some((m) => period === m)) {
    return { indefinite: false, notStated: true, over3Years: false };
  }

  // Parse duration
  const days = parsePeriodToDays(period);
  if (days === null) {
    // Unrecognized format — treat as not stated
    return { indefinite: false, notStated: true, over3Years: false };
  }

  const over3Years = days > 365 * 3;
  return {
    indefinite: false,
    notStated: false,
    over3Years,
    periodDetail: over3Years ? `${(days / 365).toFixed(1).replace(/\.0$/, "")} years` : undefined,
  };
}

/**
 * Convert a human-readable period string to approximate days.
 * Returns null if the string cannot be parsed.
 */
function parsePeriodToDays(period: string): number | null {
  // Patterns: "N years", "N months", "N days", "N weeks"
  const yearMatch = period.match(/(\d+(?:\.\d+)?)\s*year/);
  if (yearMatch) return parseFloat(yearMatch[1]) * 365;

  const monthMatch = period.match(/(\d+(?:\.\d+)?)\s*month/);
  if (monthMatch) return parseFloat(monthMatch[1]) * 30;

  const weekMatch = period.match(/(\d+(?:\.\d+)?)\s*week/);
  if (weekMatch) return parseFloat(weekMatch[1]) * 7;

  const dayMatch = period.match(/(\d+(?:\.\d+)?)\s*day/);
  if (dayMatch) return parseFloat(dayMatch[1]);

  return null;
}

// ─── v1 scoring (preserved for backward compatibility) ────────────────────────

function scoreV1(extraction: PrivacyPanel, rubric: V1Rubric): GradeResult {
  const breakdown: BreakdownItem[] = [];
  let running = rubric.startScore;

  function deduct(
    key: string,
    triggered: boolean,
    points: number,
    label: string,
    detail?: string
  ): void {
    breakdown.push({ key, label, points: triggered ? -points : 0, triggered, detail });
    if (triggered) running -= points;
  }

  function bonus(
    key: string,
    triggered: boolean,
    points: number,
    label: string,
    detail?: string
  ): void {
    breakdown.push({ key, label, points: triggered ? points : 0, triggered, detail });
    if (triggered) running += points;
  }

  // v1 extractions use the old schema shape — access via type assertion
  const e = extraction as unknown as {
    dataCollection: {
      collectsPreciseGeolocation: { value: boolean };
      collectsBiometricData: { value: boolean };
      collectsHealthData: { value: boolean };
      collectsFinancialData: { value: boolean };
    };
    dataSharing: {
      soldToThirdParties: { value: boolean };
      sharedForAdvertising: { value: boolean };
      crossSiteTracking: { value: boolean };
      usedForProfiling: { value: boolean };
      usedToTrainAI: { value: boolean };
      thirdPartyCount: number | null;
    };
    retention: { retentionDays: number | null; indefinite: boolean };
    consumerRights: {
      rightToAccess: { value: boolean };
      rightToDelete: { value: boolean };
      rightToPortability: { value: boolean };
      rightToCorrect: { value: boolean };
      rightToOptOut: { value: boolean };
      rightToNonDiscrimination: { value: boolean };
    };
    signalHonoring: { honorsGPC: { value: boolean }; honorsDNT: { value: boolean } };
    security: { measures: { name: string }[] };
  };

  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security } = e;
  const d = rubric.deductions;
  const b = rubric.bonuses;

  deduct("soldToThirdParties", dataSharing.soldToThirdParties.value, d.soldToThirdParties.points, d.soldToThirdParties.label);
  deduct("sharedForAdvertising", dataSharing.sharedForAdvertising.value, d.sharedForAdvertising.points, d.sharedForAdvertising.label);
  deduct("crossSiteTracking", dataSharing.crossSiteTracking.value, d.crossSiteTracking.points, d.crossSiteTracking.label);
  deduct("usedForProfiling", dataSharing.usedForProfiling.value, d.usedForProfiling.points, d.usedForProfiling.label);
  deduct("usedToTrainAI", dataSharing.usedToTrainAI.value, d.usedToTrainAI.points, d.usedToTrainAI.label);
  deduct("collectsPreciseGeolocation", dataCollection.collectsPreciseGeolocation.value, d.collectsPreciseGeolocation.points, d.collectsPreciseGeolocation.label);
  deduct("collectsBiometricData", dataCollection.collectsBiometricData.value, d.collectsBiometricData.points, d.collectsBiometricData.label);
  deduct("collectsHealthData", dataCollection.collectsHealthData.value, d.collectsHealthData.points, d.collectsHealthData.label);
  deduct("collectsFinancialData", dataCollection.collectsFinancialData.value, d.collectsFinancialData.points, d.collectsFinancialData.label);
  deduct("doesNotHonorGPC", !signalHonoring.honorsGPC.value, d.doesNotHonorGPC.points, d.doesNotHonorGPC.label);
  deduct("doesNotHonorDNT", !signalHonoring.honorsDNT.value, d.doesNotHonorDNT.points, d.doesNotHonorDNT.label);

  const tpCount = dataSharing.thirdPartyCount;
  const tpOver10 = tpCount !== null && tpCount > 10;
  const tp6to10 = tpCount !== null && tpCount >= 6 && tpCount <= 10;
  deduct("thirdPartiesOver10", tpOver10, d.thirdPartiesOver10.points, d.thirdPartiesOver10.label, tpCount !== null ? `${tpCount} third parties disclosed` : undefined);
  deduct("thirdParties6To10", !tpOver10 && tp6to10, d.thirdParties6To10.points, d.thirdParties6To10.label, tpCount !== null ? `${tpCount} third parties disclosed` : undefined);

  const retDays = retention.retentionDays;
  const retIndefinite = retention.indefinite;
  const retOver3Years = !retIndefinite && retDays !== null && retDays > 365 * 3;
  const retOver1Year = !retIndefinite && !retOver3Years && retDays !== null && retDays > 365;
  deduct("retentionIndefinite", retIndefinite, d.retentionIndefinite.points, d.retentionIndefinite.label);
  deduct("retentionOver3Years", retOver3Years, d.retentionOver3Years.points, d.retentionOver3Years.label, retDays !== null ? `${Math.round((retDays / 365) * 10) / 10} years` : undefined);
  deduct("retentionOver1Year", retOver1Year, d.retentionOver1Year.points, d.retentionOver1Year.label, retDays !== null ? `${Math.round((retDays / 365) * 10) / 10} years` : undefined);

  const rights = [
    consumerRights.rightToAccess.value,
    consumerRights.rightToDelete.value,
    consumerRights.rightToPortability.value,
    consumerRights.rightToCorrect.value,
    consumerRights.rightToOptOut.value,
    consumerRights.rightToNonDiscrimination.value,
  ];
  const rightsCount = Math.min(rights.filter(Boolean).length, b.perConsumerRight.maxCount);
  const rightsBonus = rightsCount * b.perConsumerRight.pointsEach;
  bonus("consumerRights", rightsBonus > 0, rightsBonus, b.perConsumerRight.label, `${rightsCount} of ${b.perConsumerRight.maxCount} rights offered`);

  const measuresCount = Math.min(security.measures.length, b.perSecurityMeasure.maxCount);
  const securityBonus = measuresCount * b.perSecurityMeasure.pointsEach;
  bonus("securityMeasures", securityBonus > 0, securityBonus, b.perSecurityMeasure.label, `${measuresCount} of ${b.perSecurityMeasure.maxCount} measures`);

  const finalScore = Math.max(0, Math.min(100, running));
  const { letter, gradeLabel, color } = resolveGrade(finalScore, rubric);

  return {
    score: finalScore,
    letter,
    label: gradeLabel,
    color,
    rubricVersion: rubric.version,
    breakdown,
  };
}

// ─── Grade resolver ───────────────────────────────────────────────────────────

function resolveGrade(
  s: number,
  rubric: Rubric
): { letter: GradeLetter; gradeLabel: string; color: string } {
  const entries = Object.entries(rubric.grades) as [
    GradeLetter,
    { min: number; max: number; label: string; color: string }
  ][];
  for (const [letter, g] of entries) {
    if (s >= g.min && s <= g.max) {
      return { letter, gradeLabel: g.label, color: g.color };
    }
  }
  return { letter: "F", gradeLabel: "Failing", color: "#b91c1c" };
}
