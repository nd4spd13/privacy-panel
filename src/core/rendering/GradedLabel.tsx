import React from "react";
import type { PrivacyPanel } from "../schema/types";
import type { GradeResult } from "../scoring/engine";
import { PrivacyPanelLabel } from "./PrivacyPanelLabel";

const GRADE_BG: Record<string, string> = {
  A: "#15803d",
  B: "#4d7c0f",
  C: "#b45309",
  D: "#c2410c",
  F: "#b91c1c",
};

export interface GradedLabelProps {
  data: PrivacyPanel;
  grade: GradeResult;
  diffFields?: Set<string>;
}

export function GradedLabel({ data, grade, diffFields }: GradedLabelProps) {
  const bg = GRADE_BG[grade.letter] ?? "#374151";

  return (
    <div style={{ width: 380, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* ── Grade header ────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: bg,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "4px 4px 0 0",
        }}
      >
        {/* Letter */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 900,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {grade.letter}
        </div>

        {/* Label + score */}
        <div style={{ flex: 1, paddingLeft: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{grade.label}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            {grade.score}/100 · Rubric v{grade.rubricVersion}
          </div>
        </div>

        {/* Score arc — simple numeric */}
        <div
          style={{
            textAlign: "right",
            fontSize: 28,
            fontWeight: 900,
            lineHeight: 1,
            opacity: 0.9,
          }}
        >
          {grade.score}
        </div>
      </div>

      {/* ── The label itself (no top border-radius since header is flush above) */}
      <div style={{ border: "2.5px solid #000", borderTop: "none" }}>
        <PrivacyPanelLabelInner data={data} diffFields={diffFields} />
      </div>

      {/* ── Grade disclaimer ─────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: 9,
          color: "#6b7280",
          padding: "4px 8px 6px",
          lineHeight: 1.5,
          border: "2.5px solid #000",
          borderTop: "none",
        }}
      >
        The grade reflects Privacy Panel' assessment based on our published rubric (v{grade.rubricVersion}). It is our opinion.
      </div>
    </div>
  );
}

/**
 * Internal version of PrivacyPanelLabel that renders without its own outer border
 * (the border is owned by GradedLabel when used in that context).
 */
function PrivacyPanelLabelInner({ data, diffFields }: { data: PrivacyPanel; diffFields?: Set<string> }) {
  // Re-use PrivacyPanelLabel but override the outer border style via a wrapper
  return (
    <div
      style={{
        // cancel the component's own border so GradedLabel's border shows instead
        margin: -2.5,
        border: "2.5px solid transparent",
        overflow: "hidden",
      }}
    >
      <PrivacyPanelLabel data={data} diffFields={diffFields} />
    </div>
  );
}
