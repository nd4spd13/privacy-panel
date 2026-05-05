import React from "react";
import type { PrivacyPanel } from "../schema/types";
import type { GradeResult } from "../scoring/engine";
import { GradedLabel } from "./GradedLabel";

export interface ComparisonEntry {
  data: PrivacyPanel;
  grade: GradeResult;
}

export interface ComparisonViewProps {
  entries: [ComparisonEntry, ComparisonEntry, ComparisonEntry?];
}

// Fields that can differ and should be highlighted
const COMPARABLE_FIELDS: Array<{ key: string; get: (d: PrivacyPanel) => unknown }> = [
  { key: "soldToThirdParties",   get: (d) => d.dataSharing.soldToThirdParties.value },
  { key: "sharedForAdvertising", get: (d) => d.dataSharing.sharedForAdvertising.value },
  { key: "crossSiteTracking",    get: (d) => d.dataSharing.crossSiteTracking.value },
  { key: "usedForProfiling",     get: (d) => d.dataSharing.usedForProfiling.value },
  { key: "usedToTrainAI",        get: (d) => d.dataSharing.usedToTrainAI.value },
  { key: "retention",            get: (d) => d.retention.longestStatedPeriod },
  { key: "honorsGPC",            get: (d) => d.signalHonoring.gpcDetail.value },
  { key: "honorsDNT",            get: (d) => d.signalHonoring.dntDetail.value },
  { key: "right_Access",         get: (d) => d.consumerRights.rightToAccess.value },
  { key: "right_Delete",         get: (d) => d.consumerRights.rightToDelete.value },
  { key: "right_Portability",    get: (d) => d.consumerRights.rightToPortability.value },
  { key: "right_Correct",        get: (d) => d.consumerRights.rightToCorrect.value },
  { key: "right_Opt-out",        get: (d) => d.consumerRights.rightToOptOut.value },
];

/**
 * Compute which fields have at least one different value across the provided entries.
 */
function computeDiffFields(entries: ComparisonEntry[]): Set<string> {
  const diffed = new Set<string>();
  for (const { key, get } of COMPARABLE_FIELDS) {
    const values = entries.map((e) => JSON.stringify(get(e.data)));
    const unique = new Set(values);
    if (unique.size > 1) diffed.add(key);
  }
  return diffed;
}

export function ComparisonView({ entries }: ComparisonViewProps) {
  const nonNull = entries.filter(Boolean) as ComparisonEntry[];
  const diffFields = computeDiffFields(nonNull);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {nonNull.map((entry) => (
          <div key={entry.data.metadata.companyName} style={{ width: 380, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{entry.data.metadata.companyName}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{entry.data.metadata.policyUrl}</div>
          </div>
        ))}
      </div>

      {/* ── Labels side by side ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {nonNull.map((entry) => (
          <GradedLabel
            key={entry.data.metadata.companyName}
            data={entry.data}
            grade={entry.grade}
            diffFields={diffFields}
          />
        ))}
      </div>

      {/* ── Diff legend ──────────────────────────────────────────────────── */}
      {diffFields.size > 0 && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              backgroundColor: "#fef9c3",
              border: "1px solid #d97706",
              borderRadius: 2,
            }}
          />
          <span>Highlighted fields differ between companies</span>
        </div>
      )}
    </div>
  );
}
