/**
 * embed.ts — Generate self-contained HTML/SVG strings for Privacy Facts labels.
 *
 * Deliberately does NOT import react-dom/server to stay compatible with
 * Next.js App Router's webpack restrictions. HTML is generated via string
 * templates that mirror the PrivacyFactsLabel / GradedLabel component output.
 */

import type { PrivacyFacts } from "../schema/types";
import type { GradeResult } from "../scoring/engine";

const W = 380;

const GRADE_BG: Record<string, string> = {
  A: "#15803d",
  B: "#4d7c0f",
  C: "#b45309",
  D: "#c2410c",
  F: "#b91c1c",
};

// ─── HTML generator ───────────────────────────────────────────────────────────

export function renderToHTML(data: PrivacyFacts, grade: GradeResult): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Privacy Facts — ${esc(data.metadata.companyName)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:16px}</style>
</head>
<body>
  ${labelHTML(data, grade)}
</body>
</html>`;
}

export function renderNeutralToHTML(data: PrivacyFacts): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Privacy Facts — ${esc(data.metadata.companyName)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:16px}</style>
</head>
<body>
  ${neutralLabelHTML(data)}
</body>
</html>`;
}

export function renderToSVG(data: PrivacyFacts, grade: GradeResult): string {
  const inner = labelHTML(data, grade);
  const h = 860;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
  <style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}</style>
  <foreignObject x="0" y="0" width="${W}" height="${h}">
    <xhtml:div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px">
      ${inner}
    </xhtml:div>
  </foreignObject>
</svg>`;
}

export function renderEmbedSnippet(data: PrivacyFacts, grade: GradeResult, baseUrl = "https://privacyfacts.org"): string {
  const slug = data.metadata.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<!-- Privacy Facts widget for ${esc(data.metadata.companyName)} -->
<iframe src="${baseUrl}/embed/${slug}" width="${W}" height="860" style="border:none;overflow:hidden" title="Privacy Facts — ${esc(data.metadata.companyName)} — Grade ${grade.letter}" loading="lazy"></iframe>`;
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function labelHTML(data: PrivacyFacts, grade: GradeResult): string {
  const bg = GRADE_BG[grade.letter] ?? "#374151";
  return `<div style="width:${W}px;font-family:Arial,Helvetica,sans-serif">
  <div style="background:${bg};color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:4px 4px 0 0">
    <div style="width:52px;height:52px;border-radius:50%;border:3px solid rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;flex-shrink:0">${esc(grade.letter)}</div>
    <div style="flex:1;padding-left:12px">
      <div style="font-size:18px;font-weight:800">${esc(grade.label)}</div>
      <div style="font-size:12px;opacity:0.85;margin-top:2px">${grade.score}/100 · Rubric v${esc(grade.rubricVersion)}</div>
    </div>
    <div style="font-size:28px;font-weight:900;opacity:0.9">${grade.score}</div>
  </div>
  ${neutralLabelHTML(data)}
  <div style="font-size:9px;color:#6b7280;padding:4px 8px 6px;line-height:1.5;border:2.5px solid #000;border-top:none">
    The grade reflects Privacy Facts' assessment based on our published rubric (v${esc(grade.rubricVersion)}). It is our opinion.
  </div>
</div>`;
}

function neutralLabelHTML(data: PrivacyFacts): string {
  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security, metadata } = data;

  const retLabel = retentionLabel(retention);

  const rights = [
    { label: "Access", v: consumerRights.rightToAccess.value },
    { label: "Delete", v: consumerRights.rightToDelete.value },
    { label: "Portability", v: consumerRights.rightToPortability.value },
    { label: "Correct", v: consumerRights.rightToCorrect.value },
    { label: "Opt-out", v: consumerRights.rightToOptOut.value },
    { label: "Non-discrimination", v: consumerRights.rightToNonDiscrimination.value },
  ];

  const measures = security.measures.slice(0, 6);

  return `<div style="width:${W}px;border:2.5px solid #000;font-family:Arial,Helvetica,sans-serif;background:#fff">
  <div style="padding:8px 8px 6px;border-bottom:7px solid #000">
    <div style="font-size:34px;font-weight:900;letter-spacing:-0.02em;line-height:1.05">Privacy Facts</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px">${esc(metadata.companyName)}</div>
  </div>

  <div style="padding:6px 8px 2px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Data Collected</div>
    ${dataCollection.items.length === 0
      ? `<div style="font-size:12px;color:#6b7280;padding-bottom:4px">None disclosed</div>`
      : dataCollection.items.map((item) =>
          `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
            <span style="color:${item.sensitive ? "#b91c1c" : "#6b7280"};font-size:10px">${item.sensitive ? "●" : "○"}</span>
            <span style="font-size:12px;color:${item.sensitive ? "#b91c1c" : "#000"};font-weight:${item.sensitive ? 600 : 400}">${esc(item.name)}</span>
            ${item.sensitive ? `<span style="font-size:9px;color:#b91c1c;font-weight:600">sensitive</span>` : ""}
          </div>`
        ).join("")
    }
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:4px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Data Sharing &amp; Use</div>
    ${practiceRow("Sold to third parties", dataSharing.soldToThirdParties.value, true)}
    ${practiceRow("Shared for advertising", dataSharing.sharedForAdvertising.value)}
    ${practiceRow("Cross-site tracking", dataSharing.crossSiteTracking.value)}
    ${practiceRow("Used for profiling / AI decisions", dataSharing.usedForProfiling.value)}
    ${practiceRow("Used to train AI models", dataSharing.usedToTrainAI.value)}
    ${dataSharing.thirdPartyCount !== null
      ? `<div style="font-size:11px;color:#6b7280;padding-top:4px">Third parties: <span style="font-weight:700;color:${dataSharing.thirdPartyCount > 10 ? "#b91c1c" : "#000"}">${dataSharing.thirdPartyCount}</span></div>`
      : ""}
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:4px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Data Retention</div>
    <div style="font-size:13px;font-weight:700;color:${retLabel.color};padding-bottom:2px">${esc(retLabel.text)}</div>
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:4px 8px">
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Consumer Rights</div>
        ${rights.map((r) => checkItem(r.label, r.v)).join("")}
      </div>
      <div style="flex:1;border-left:0.5px solid #000;padding-left:12px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Security</div>
        ${measures.length === 0
          ? `<div style="font-size:11px;color:#6b7280">None disclosed</div>`
          : measures.map((m) => checkItem(m.name, true)).join("")}
      </div>
    </div>
  </div>

  <div style="border-top:7px solid #000"></div>

  <div style="padding:4px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Privacy Signals</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      ${signalPill("GPC", signalHonoring.honorsGPC.value)}
      ${signalPill("DNT", signalHonoring.honorsDNT.value)}
    </div>
  </div>

  <div style="border-top:0.5px solid #d1d5db"></div>

  <div style="padding:6px 8px">
    <div style="font-size:9px;color:#6b7280;line-height:1.5">
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

function practiceRow(label: string, value: boolean, critical = false): string {
  const badge = value
    ? `<span style="display:inline-block;background:${critical ? "#b91c1c" : "#000"};color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:3px;min-width:32px;text-align:center">YES</span>`
    : `<span style="display:inline-block;color:#6b7280;font-size:9px;font-weight:600;padding:2px 6px;border:0.5px solid #6b7280;border-radius:3px;min-width:32px;text-align:center">no</span>`;
  return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0">
    ${badge}
    <span style="font-size:12px;font-weight:${value ? 600 : 400};color:${value && critical ? "#b91c1c" : "#000"}">${esc(label)}</span>
  </div>`;
}

function checkItem(label: string, checked: boolean): string {
  const bg = checked ? "#15803d" : "transparent";
  const border = checked ? "#15803d" : "#6b7280";
  const check = checked
    ? `<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : "";
  return `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">
    <div style="width:12px;height:12px;border:1.5px solid ${border};border-radius:2px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${check}</div>
    <span style="font-size:11px;color:#000">${esc(label)}</span>
  </div>`;
}

function signalPill(label: string, honored: boolean): string {
  const bg = honored ? "#15803d" : "#b91c1c";
  const text = honored ? "honored" : "not honored";
  return `<div style="display:flex;align-items:center;gap:6px">
    <span style="display:inline-block;background:${bg};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px">${text}</span>
    <span style="font-size:12px">${esc(label)}</span>
  </div>`;
}

function retentionLabel(retention: PrivacyFacts["retention"]): { text: string; color: string } {
  if (retention.indefinite) return { text: "Indefinite", color: "#b91c1c" };
  if (retention.retentionDays === null) return { text: "Not specified", color: "#6b7280" };
  const days = retention.retentionDays;
  if (days <= 90) return { text: `${days} days`, color: "#15803d" };
  if (days <= 365) return { text: `${days} days`, color: "#000" };
  const years = (days / 365).toFixed(1).replace(/\.0$/, "");
  return { text: `${years} years`, color: days > 365 * 3 ? "#b91c1c" : "#000" };
}
