/**
 * embed.ts — Generate self-contained HTML/SVG strings for Privacy Panel labels.
 *
 * Deliberately does NOT import react-dom/server to stay compatible with
 * Next.js App Router's webpack restrictions. HTML is generated via string
 * templates that mirror the PrivacyPanelLabel / GradedLabel component output.
 */

import type { PrivacyPanel } from "../schema/types";
import type { GradeResult } from "../scoring/engine";

const GRADE_BG: Record<string, string> = {
  A: "#15803d",
  B: "#4d7c0f",
  C: "#b45309",
  D: "#c2410c",
  F: "#b91c1c",
};

// ─── HTML generator ───────────────────────────────────────────────────────────

export function renderToHTML(data: PrivacyPanel, grade: GradeResult, width = 380): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Privacy Panel — ${esc(data.metadata.companyName)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:16px}</style>
</head>
<body>
  ${labelHTML(data, grade, width)}
</body>
</html>`;
}

export function renderNeutralToHTML(data: PrivacyPanel, width = 380): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Privacy Panel — ${esc(data.metadata.companyName)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:16px}</style>
</head>
<body>
  ${neutralLabelHTML(data, width)}
</body>
</html>`;
}

export function renderToSVG(data: PrivacyPanel, grade: GradeResult, width = 380): string {
  const inner = labelHTML(data, grade, width);
  const h = Math.round(860 * width / 380);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
  <style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}</style>
  <foreignObject x="0" y="0" width="${width}" height="${h}">
    <xhtml:div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px">
      ${inner}
    </xhtml:div>
  </foreignObject>
</svg>`;
}

export function renderNeutralToSVG(data: PrivacyPanel, width = 380): string {
  const inner = neutralLabelHTML(data, width);
  const h = Math.round(700 * width / 380);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
  <style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}</style>
  <foreignObject x="0" y="0" width="${width}" height="${h}">
    <xhtml:div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px">
      ${inner}
    </xhtml:div>
  </foreignObject>
</svg>`;
}

export function renderEmbedSnippet(data: PrivacyPanel, grade: GradeResult, baseUrl = "https://privacypanel.org", width = 380, withGrade = true): string {
  const slug = data.metadata.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const h = Math.round((withGrade ? 860 : 700) * width / 380);
  const titleSuffix = withGrade ? ` — Grade ${grade.letter}` : "";
  return `<!-- Privacy Panel widget for ${esc(data.metadata.companyName)} -->
<iframe src="${baseUrl}/embed/${slug}" width="${width}" height="${h}" style="border:none;overflow:hidden" title="Privacy Panel — ${esc(data.metadata.companyName)}${titleSuffix}" loading="lazy"></iframe>`;
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function labelHTML(data: PrivacyPanel, grade: GradeResult, width: number): string {
  const f = (n: number) => Math.round(n * width / 380);
  const bg = GRADE_BG[grade.letter] ?? "#374151";
  return `<div style="width:${width}px;font-family:Arial,Helvetica,sans-serif">
  <div style="background:${bg};color:#fff;display:flex;align-items:center;justify-content:space-between;padding:${f(10)}px ${f(12)}px;border-radius:4px 4px 0 0">
    <div style="width:${f(52)}px;height:${f(52)}px;border-radius:50%;border:3px solid rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;font-size:${f(32)}px;font-weight:900;flex-shrink:0">${esc(grade.letter)}</div>
    <div style="flex:1;padding-left:${f(12)}px">
      <div style="font-size:${f(18)}px;font-weight:800">${esc(grade.label)}</div>
      <div style="font-size:${f(12)}px;opacity:0.85;margin-top:${f(2)}px">${grade.score}/100 · Rubric v${esc(grade.rubricVersion)}</div>
    </div>
    <div style="font-size:${f(28)}px;font-weight:900;opacity:0.9">${grade.score}</div>
  </div>
  ${neutralLabelHTML(data, width)}
  <div style="font-size:${f(9)}px;color:#6b7280;padding:${f(4)}px ${f(8)}px ${f(6)}px;line-height:1.5;border:2.5px solid #000;border-top:none">
    The grade reflects Privacy Panel's assessment based on our published rubric (v${esc(grade.rubricVersion)}). It is our opinion.
  </div>
</div>`;
}

function neutralLabelHTML(data: PrivacyPanel, width: number): string {
  const f = (n: number) => Math.round(n * width / 380);
  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security, metadata, thirdPartyRecipients } = data;

  const retLabel = retentionLabel(retention);

  const rights = [
    { label: "Access", v: consumerRights.rightToAccess.value },
    { label: "Delete", v: consumerRights.rightToDelete.value },
    { label: "Portability", v: consumerRights.rightToPortability.value },
    { label: "Correct", v: consumerRights.rightToCorrect.value },
    { label: "Opt-out", v: consumerRights.rightToOptOut.value },
  ];

  const securityItems = [
    { label: "Encrypted in transit", v: security.encryptedInTransit.value },
    { label: "Encrypted at rest", v: security.encryptedAtRest.value },
    { label: "MFA available", v: security.mfaAvailable.value },
    { label: "Breach notification", v: security.breachNotification.value },
  ];

  return `<div style="width:${width}px;border:2.5px solid #000;font-family:Arial,Helvetica,sans-serif;background:#fff">
  <div style="padding:${f(8)}px ${f(8)}px ${f(6)}px;border-bottom:7px solid #000">
    <div style="font-size:${f(34)}px;font-weight:900;letter-spacing:-0.02em;line-height:1.05">Privacy Panel</div>
    <div style="font-size:${f(12)}px;color:#6b7280;margin-top:${f(2)}px">${esc(metadata.companyName)}</div>
  </div>

  <div style="padding:${f(6)}px ${f(8)}px ${f(2)}px">
    <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Data Collected</div>
    ${dataCollection.items.length === 0
      ? `<div style="font-size:${f(12)}px;color:#6b7280;padding-bottom:${f(4)}px">None disclosed</div>`
      : dataCollection.items.map((item) =>
          `<div style="display:flex;align-items:center;gap:${f(6)}px;padding:${f(2)}px 0">
            <span style="color:${item.sensitive ? "#b91c1c" : "#6b7280"};font-size:${f(10)}px">${item.sensitive ? "●" : "○"}</span>
            <span style="font-size:${f(12)}px;color:${item.sensitive ? "#b91c1c" : "#000"};font-weight:${item.sensitive ? 600 : 400}">${esc(item.name)}</span>
            ${item.sensitive ? `<span style="font-size:${f(9)}px;color:#b91c1c;font-weight:600">sensitive</span>` : ""}
          </div>`
        ).join("")
    }
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:${f(4)}px ${f(8)}px">
    <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Data Sharing &amp; Use</div>
    ${practiceRow("Sold to third parties", dataSharing.soldToThirdParties.value, true, f)}
    ${practiceRow("Shared for advertising", dataSharing.sharedForAdvertising.value, false, f)}
    ${practiceRow("Cross-site tracking", dataSharing.crossSiteTracking.value, false, f)}
    ${practiceRow("Used for profiling / AI decisions", dataSharing.usedForProfiling.value, false, f)}
    ${practiceRow("Used to train AI models", dataSharing.usedToTrainAI.value, false, f)}
    ${thirdPartyRecipients.categoryCount !== null
      ? `<div style="font-size:${f(11)}px;color:#6b7280;padding-top:${f(4)}px">Third parties: <span style="font-weight:700;color:${(thirdPartyRecipients.categoryCount ?? 0) > 10 ? "#b91c1c" : "#000"}">${thirdPartyRecipients.categoryCount}</span></div>`
      : ""}
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:${f(4)}px ${f(8)}px">
    <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Data Retention</div>
    <div style="font-size:${f(13)}px;font-weight:700;color:${retLabel.color};padding-bottom:${f(2)}px">${esc(retLabel.text)}</div>
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:${f(4)}px ${f(8)}px">
    <div style="display:flex;gap:${f(12)}px">
      <div style="flex:1">
        <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Consumer Rights</div>
        ${rights.map((r) => checkItem(r.label, r.v, f)).join("")}
      </div>
      <div style="flex:1;border-left:0.5px solid #000;padding-left:${f(12)}px">
        <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Security</div>
        ${securityItems.map((m) => checkItem(m.label, m.v, f)).join("")}
      </div>
    </div>
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:${f(4)}px ${f(8)}px">
    <div style="font-size:${f(11)}px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:${f(4)}px">Privacy Signals</div>
    <div style="display:flex;gap:${f(12)}px;flex-wrap:wrap">
      ${signalPill("GPC", signalHonoring.gpcDetail.value, f)}
      ${signalPill("DNT", signalHonoring.dntDetail.value, f)}
    </div>
  </div>

  <div style="border-top:0.5px solid #d1d5db"></div>

  <div style="padding:${f(6)}px ${f(8)}px">
    <div style="font-size:${f(9)}px;color:#6b7280;line-height:1.5">
      This label summarizes privacy practices as disclosed in the company's privacy policy. This is not legal advice.
      <a href="${esc(metadata.policyUrl)}" style="color:#6b7280" target="_blank">Full policy ↗</a>
    </div>
  </div>
</div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type F = (n: number) => number;

function practiceRow(label: string, value: boolean | null, critical = false, f: F): string {
  const badge = value === true
    ? `<span style="display:inline-block;background:${critical ? "#b91c1c" : "#000"};color:#fff;font-size:${f(9)}px;font-weight:800;padding:${f(2)}px ${f(6)}px;border-radius:${f(3)}px;min-width:${f(32)}px;text-align:center">YES</span>`
    : value === null
    ? `<span style="display:inline-block;color:#6b7280;font-size:${f(9)}px;font-weight:600;padding:${f(2)}px ${f(6)}px;border:0.5px solid #6b7280;border-radius:${f(3)}px;min-width:${f(32)}px;text-align:center">?</span>`
    : `<span style="display:inline-block;color:#6b7280;font-size:${f(9)}px;font-weight:600;padding:${f(2)}px ${f(6)}px;border:0.5px solid #6b7280;border-radius:${f(3)}px;min-width:${f(32)}px;text-align:center">no</span>`;
  return `<div style="display:flex;align-items:center;gap:${f(8)}px;padding:${f(3)}px 0">
    ${badge}
    <span style="font-size:${f(12)}px;font-weight:${value === true ? 600 : 400};color:${value === true && critical ? "#b91c1c" : "#000"}">${esc(label)}</span>
  </div>`;
}

function checkItem(label: string, checked: boolean | null, f: F): string {
  const bg = checked ? "#15803d" : "transparent";
  const border = checked ? "#15803d" : "#6b7280";
  const sz = f(12);
  const check = checked
    ? `<svg width="${f(8)}" height="${f(8)}" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : "";
  return `<div style="display:flex;align-items:center;gap:${f(5)}px;padding:${f(2)}px 0">
    <div style="width:${sz}px;height:${sz}px;border:1.5px solid ${border};border-radius:${f(2)}px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${check}</div>
    <span style="font-size:${f(11)}px;color:#000">${esc(label)}</span>
  </div>`;
}

function signalPill(label: string, honored: boolean | null, f: F): string {
  const bg = honored === true ? "#15803d" : honored === false ? "#b91c1c" : "#6b7280";
  const text = honored === true ? "honored" : honored === false ? "not honored" : "unknown";
  return `<div style="display:flex;align-items:center;gap:${f(6)}px">
    <span style="display:inline-block;background:${bg};color:#fff;font-size:${f(9)}px;font-weight:700;padding:${f(2)}px ${f(6)}px;border-radius:${f(10)}px">${text}</span>
    <span style="font-size:${f(12)}px">${esc(label)}</span>
  </div>`;
}

function retentionLabel(retention: PrivacyPanel["retention"]): { text: string; color: string } {
  const period = retention.longestStatedPeriod;
  if (!period || period === "not stated") return { text: "Not specified", color: "#6b7280" };
  if (period === "indefinitely") return { text: "Indefinite", color: "#b91c1c" };
  // Try to infer color from the string (> 3 years → red)
  const yearsMatch = period.match(/^(\d+(?:\.\d+)?)\s*years?$/i);
  if (yearsMatch) {
    const y = parseFloat(yearsMatch[1]);
    return { text: period, color: y > 3 ? "#b91c1c" : y > 1 ? "#000" : "#15803d" };
  }
  return { text: period, color: "#000" };
}
