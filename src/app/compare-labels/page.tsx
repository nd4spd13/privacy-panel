import { notFound } from "next/navigation";
import { join } from "path";
import { getDb } from "@/db/client";
import { migrateV1ToV2 } from "@/core/extraction/validator";
import { score } from "@/core/scoring/engine";
import { loadRubricOrThrow } from "@/core/scoring/rubric";
import { GradedLabel } from "@/core/rendering/GradedLabel";
import { PrivacyPanelLabelV1 } from "@/core/rendering/PrivacyPanelLabelV1";
import type { GradeResult } from "@/core/scoring/engine";

export const dynamic = "force-dynamic";

const GRADE_BG: Record<string, string> = {
  A: "#15803d", B: "#4d7c0f", C: "#b45309", D: "#c2410c", F: "#b91c1c",
};

function GradeHeader({ grade }: { grade: { letter: string; label: string; score: number; rubricVersion: string } }) {
  const bg = GRADE_BG[grade.letter] ?? "#374151";
  return (
    <div style={{
      backgroundColor: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: "Arial, Helvetica, sans-serif" }}>{grade.letter}</span>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Arial, Helvetica, sans-serif" }}>{grade.label}</div>
          <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "Arial, Helvetica, sans-serif" }}>
            {grade.score}/100 · Rubric v{grade.rubricVersion}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "Arial, Helvetica, sans-serif" }}>{grade.score}</div>
    </div>
  );
}

export default function CompareLabelPage() {
  const row = getDb()
    .prepare(
      `SELECT e.*, c.name as company_name, c.slug as company_slug
       FROM extractions e JOIN companies c ON e.company_id = c.id
       WHERE c.slug = 'poshmark'
       ORDER BY e.created_at DESC LIMIT 1`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .get() as any;

  if (!row) notFound();

  const v1Facts = JSON.parse(row.facts_json);
  const v1Grade = {
    letter: row.letter as string,
    label: row.grade_label as string,
    score: row.score as number,
    rubricVersion: row.rubric_version as string,
  };

  const migrated = migrateV1ToV2(v1Facts);
  if (!migrated.success) notFound();

  const rubric = loadRubricOrThrow(join(process.cwd(), "src/core/scoring/rubric.v2.yaml"));
  const v2Grade = score(migrated.data, rubric) as GradeResult;

  return (
    <main style={{ padding: "40px 32px", backgroundColor: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          Label Comparison — Poshmark
        </h1>
        <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13, color: "#6b7280", marginBottom: 36 }}>
          Same company, same extracted policy data — rendered with the original v1 label design (left) vs the new v2 label (right).
        </p>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
          {/* V1 */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 }}>
              Schema v1 · Rubric v1
            </div>
            <div style={{ width: 380 }}>
              <GradeHeader grade={v1Grade} />
              <PrivacyPanelLabelV1 data={v1Facts} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ alignSelf: "stretch", width: 1, backgroundColor: "#d1d5db", flexShrink: 0 }} />

          {/* V2 */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 }}>
              Schema v2 · Rubric v2
            </div>
            <GradedLabel data={migrated.data} grade={v2Grade} />
          </div>
        </div>

        <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, color: "#9ca3af", marginTop: 40, lineHeight: 1.6 }}>
          The v2 label adds: three-state badges (yes/no/?), subordinate data item display (sensitive floated top in red), structured third-party recipient categories, purposes section, AI training opt-out + independent audit bonuses, and browser signal pill. Retention is now a plain-language string rather than a calculated days figure.
        </p>
      </div>
    </main>
  );
}
