import type { PrivacyFacts } from "../schema/types";
import type { Rubric, GradeLetter } from "./rubric";

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
 * Score a PrivacyFacts extraction against a rubric.
 * Pure function — no side effects, no I/O. Same inputs always produce same output.
 */
export function score(extraction: PrivacyFacts, rubric: Rubric): GradeResult {
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

  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security } =
    extraction;
  const d = rubric.deductions;
  const b = rubric.bonuses;

  // ── Deductions ─────────────────────────────────────────────────────────────

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

  // Third-party tiers (mutually exclusive — apply highest matching tier only)
  const tpCount = dataSharing.thirdPartyCount;
  const tpOver10 = tpCount !== null && tpCount > 10;
  const tp6to10 = tpCount !== null && tpCount >= 6 && tpCount <= 10;
  deduct(
    "thirdPartiesOver10",
    tpOver10,
    d.thirdPartiesOver10.points,
    d.thirdPartiesOver10.label,
    tpCount !== null ? `${tpCount} third parties disclosed` : undefined
  );
  deduct(
    "thirdParties6To10",
    !tpOver10 && tp6to10,
    d.thirdParties6To10.points,
    d.thirdParties6To10.label,
    tpCount !== null ? `${tpCount} third parties disclosed` : undefined
  );

  // Retention tiers (mutually exclusive — apply highest matching tier only)
  const retDays = retention.retentionDays;
  const retIndefinite = retention.indefinite;
  const retOver3Years = !retIndefinite && retDays !== null && retDays > 365 * 3;
  const retOver1Year =
    !retIndefinite && !retOver3Years && retDays !== null && retDays > 365;

  deduct("retentionIndefinite", retIndefinite, d.retentionIndefinite.points, d.retentionIndefinite.label);
  deduct(
    "retentionOver3Years",
    retOver3Years,
    d.retentionOver3Years.points,
    d.retentionOver3Years.label,
    retDays !== null ? `${Math.round(retDays / 365 * 10) / 10} years` : undefined
  );
  deduct(
    "retentionOver1Year",
    retOver1Year,
    d.retentionOver1Year.points,
    d.retentionOver1Year.label,
    retDays !== null ? `${Math.round(retDays / 365 * 10) / 10} years` : undefined
  );

  // ── Bonuses ────────────────────────────────────────────────────────────────

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
  bonus(
    "consumerRights",
    rightsBonus > 0,
    rightsBonus,
    b.perConsumerRight.label,
    `${rightsCount} of ${b.perConsumerRight.maxCount} rights offered`
  );

  const measuresCount = Math.min(security.measures.length, b.perSecurityMeasure.maxCount);
  const securityBonus = measuresCount * b.perSecurityMeasure.pointsEach;
  bonus(
    "securityMeasures",
    securityBonus > 0,
    securityBonus,
    b.perSecurityMeasure.label,
    `${measuresCount} of ${b.perSecurityMeasure.maxCount} measures`
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
  // Fallback (should never happen with clamped score and complete rubric)
  return { letter: "F", gradeLabel: "Failing", color: "#b91c1c" };
}
