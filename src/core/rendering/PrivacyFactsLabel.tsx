import React from "react";
import type { PrivacyFacts } from "../schema/types";

// ─── Design tokens ────────────────────────────────────────────────────────────

const W = 380; // fixed label width (px)

const COLOR = {
  black: "#000000",
  white: "#ffffff",
  red: "#b91c1c",
  redBg: "#fef2f2",
  amber: "#b45309",
  amberBg: "#fffbeb",
  green: "#15803d",
  gray: "#6b7280",
  grayLight: "#f9fafb",
  border: "#000000",
};

const RULE = {
  thick: "7px solid #000",
  medium: "3px solid #000",
  thin: "0.5px solid #000",
  thinGray: "0.5px solid #d1d5db",
};

// ─── Primitive layout helpers ─────────────────────────────────────────────────

function Rule({ weight = "thin" }: { weight?: "thick" | "medium" | "thin" | "thinGray" }) {
  return <div style={{ borderTop: RULE[weight], margin: 0 }} />;
}

function Section({ children, pt = 4, pb = 4 }: { children: React.ReactNode; pt?: number; pb?: number }) {
  return <div style={{ paddingTop: pt, paddingBottom: pb, paddingLeft: 8, paddingRight: 8 }}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: COLOR.gray, marginBottom: 4 }}>
      {children}
    </div>
  );
}

// ─── Practice value badge ─────────────────────────────────────────────────────

/** Renders YES (red/black), no, or ? (amber) based on nullable boolean */
function PracticeValueBadge({ value, critical = false }: { value: boolean | null; critical?: boolean }) {
  if (value === true) {
    return (
      <span style={{
        display: "inline-block",
        backgroundColor: critical ? COLOR.red : COLOR.black,
        color: COLOR.white,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.08em",
        padding: "2px 6px",
        borderRadius: 3,
        fontFamily: "Arial, Helvetica, sans-serif",
        minWidth: 32,
        textAlign: "center",
      }}>YES</span>
    );
  }
  if (value === null) {
    return (
      <span style={{
        display: "inline-block",
        backgroundColor: COLOR.amberBg,
        color: COLOR.amber,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: "2px 6px",
        borderRadius: 3,
        border: `0.5px solid ${COLOR.amber}`,
        fontFamily: "Arial, Helvetica, sans-serif",
        minWidth: 32,
        textAlign: "center",
      }}>?</span>
    );
  }
  // false
  return (
    <span style={{
      display: "inline-block",
      backgroundColor: "transparent",
      color: COLOR.gray,
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.04em",
      padding: "2px 6px",
      border: `0.5px solid ${COLOR.gray}`,
      borderRadius: 3,
      fontFamily: "Arial, Helvetica, sans-serif",
      minWidth: 32,
      textAlign: "center",
    }}>no</span>
  );
}

// ─── Practice row ──────────────────────────────────────────────────────────────

function PracticeRow({
  label,
  value,
  critical = false,
}: {
  label: string;
  value: boolean | null;
  critical?: boolean;
}) {
  const labelColor = value === true && critical ? COLOR.red : value === null ? COLOR.amber : COLOR.black;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 3, paddingBottom: 3 }}>
      <PracticeValueBadge value={value} critical={critical} />
      <span style={{ fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: value ? 600 : 400, color: labelColor }}>
        {label}
      </span>
    </div>
  );
}

// ─── Checkbox item ────────────────────────────────────────────────────────────

function CheckItem({ label, checked }: { label: string; checked: boolean | null }) {
  const isChecked = checked === true;
  const isUnknown = checked === null;
  const borderColor = isChecked ? COLOR.green : isUnknown ? COLOR.amber : COLOR.gray;
  const bgColor = isChecked ? COLOR.green : "transparent";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 2, paddingBottom: 2 }}>
      <div style={{
        width: 12,
        height: 12,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 2,
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {isChecked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isUnknown && (
          <span style={{ fontSize: 8, color: COLOR.amber, fontWeight: 700, lineHeight: 1 }}>?</span>
        )}
      </div>
      <span style={{ fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif", color: COLOR.black }}>
        {label}
      </span>
    </div>
  );
}

// ─── Browser signal pill ──────────────────────────────────────────────────────

function SignalStatusPill({ status }: { status: "yes" | "partial" | "no" | null }) {
  if (status === null) {
    return (
      <span style={{
        display: "inline-block",
        backgroundColor: COLOR.amberBg,
        color: COLOR.amber,
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 10,
        border: `0.5px solid ${COLOR.amber}`,
      }}>unknown</span>
    );
  }
  const bgColor = status === "no" ? COLOR.red : status === "partial" ? COLOR.amber : COLOR.green;
  return (
    <span style={{
      display: "inline-block",
      backgroundColor: bgColor,
      color: COLOR.white,
      fontSize: 9,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 10,
      letterSpacing: "0.04em",
    }}>
      {status === "yes" ? "honored" : status === "partial" ? "partial" : "not honored"}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PrivacyFactsLabelProps {
  data: PrivacyFacts;
  /** Highlight fields that differ from a reference label (used in ComparisonView) */
  diffFields?: Set<string>;
}

export function PrivacyFactsLabel({ data, diffFields }: PrivacyFactsLabelProps) {
  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security, thirdPartyRecipients, supplementary, metadata, purposes } = data;

  function highlightStyle(field: string): React.CSSProperties {
    return diffFields?.has(field) ? { backgroundColor: "#fef9c3", borderRadius: 3 } : {};
  }

  // Retention display
  const retentionDisplay = (() => {
    const p = retention.longestStatedPeriod.trim().toLowerCase();
    if (["indefinitely", "indefinite"].some((m) => p.includes(m))) {
      return { text: "Indefinite", color: COLOR.red };
    }
    if (["not stated", "not specified", "not disclosed", "unspecified", ""].includes(p)) {
      return { text: "Not disclosed", color: COLOR.gray };
    }
    // Try to show as-is with color coding
    const yearMatch = p.match(/(\d+(?:\.\d+)?)\s*year/);
    const dayMatch = p.match(/(\d+)\s*day/);
    const monthMatch = p.match(/(\d+)\s*month/);
    let days = 0;
    if (yearMatch) days = parseFloat(yearMatch[1]) * 365;
    else if (monthMatch) days = parseFloat(monthMatch[1]) * 30;
    else if (dayMatch) days = parseInt(dayMatch[1], 10);

    if (days > 0 && days <= 90) return { text: retention.longestStatedPeriod, color: COLOR.green };
    if (days > 365 * 3) return { text: retention.longestStatedPeriod, color: COLOR.red };
    return { text: retention.longestStatedPeriod, color: COLOR.black };
  })();

  const rights = [
    { label: "Access", value: consumerRights.rightToAccess.value },
    { label: "Delete", value: consumerRights.rightToDelete.value },
    { label: "Portability", value: consumerRights.rightToPortability.value },
    { label: "Correct", value: consumerRights.rightToCorrect.value },
    { label: "Opt-out", value: consumerRights.rightToOptOut.value },
  ];

  const securityItems = [
    { label: "Encrypted in transit", value: security.encryptedInTransit.value },
    { label: "Encrypted at rest", value: security.encryptedAtRest.value },
    { label: "MFA available", value: security.mfaAvailable.value },
    { label: "Breach notification", value: security.breachNotification.value },
  ];

  // Top purposes to show (only positively stated ones)
  const activePurposes = [
    { label: "Core service", value: purposes.provideCoreService.value },
    { label: "Security / fraud", value: purposes.securityFraudPrevention.value },
    { label: "Advertising", value: purposes.advertisingMarketing.value },
    { label: "Personalization", value: purposes.personalization.value },
    { label: "Analytics", value: purposes.analyticsResearch.value },
    { label: "AI/ML training", value: purposes.aiMlTraining.value },
    { label: "Third-party partnerships", value: purposes.thirdPartyDataPartnerships.value },
  ].filter((p) => p.value === true);

  return (
    <div style={{
      width: W,
      border: `2.5px solid ${COLOR.border}`,
      fontFamily: "Arial, Helvetica, sans-serif",
      backgroundColor: COLOR.white,
      boxSizing: "border-box",
    }}>
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "8px 8px 6px 8px", borderBottom: RULE.thick }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Privacy Facts
        </div>
        <div style={{ fontSize: 12, color: COLOR.gray, marginTop: 2 }}>
          {metadata.companyName}
        </div>
      </div>

      {/* ── Data Collected ───────────────────────────────────────────────── */}
      <Section pt={6} pb={4}>
        <SectionLabel>Data Collected</SectionLabel>
        {dataCollection.items.length === 0 ? (
          <div style={{ fontSize: 10, color: COLOR.gray }}>None disclosed</div>
        ) : (
          <div style={{ paddingLeft: 4 }}>
            {/* Sensitive items first */}
            {dataCollection.items.filter(i => i.sensitive).map((item, i) => (
              <div key={`s${i}`} style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 1.5, paddingBottom: 1.5 }}>
                <span style={{ color: COLOR.red, fontSize: 9, lineHeight: 1, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 10, color: COLOR.red, fontWeight: 600 }}>{item.name}</span>
                <span style={{ fontSize: 8, color: COLOR.red, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginLeft: 2 }}>sensitive</span>
              </div>
            ))}
            {/* Non-sensitive items */}
            {dataCollection.items.filter(i => !i.sensitive).map((item, i) => (
              <div key={`n${i}`} style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 1.5, paddingBottom: 1.5 }}>
                <span style={{ color: COLOR.gray, fontSize: 9, lineHeight: 1, flexShrink: 0 }}>○</span>
                <span style={{ fontSize: 10, color: COLOR.gray }}>{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Rule weight="thick" />

      {/* ── Data Sharing & Use ────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Data Sharing &amp; Use</SectionLabel>
        <div style={highlightStyle("soldToThirdParties")}>
          <PracticeRow label="Sold to third parties" value={dataSharing.soldToThirdParties.value} critical />
        </div>
        <div style={highlightStyle("sharedForAdvertising")}>
          <PracticeRow label="Shared for advertising" value={dataSharing.sharedForAdvertising.value} />
        </div>
        <div style={highlightStyle("crossSiteTracking")}>
          <PracticeRow label="Cross-site tracking" value={dataSharing.crossSiteTracking.value} />
        </div>
        <div style={highlightStyle("usedForProfiling")}>
          <PracticeRow label="Used for profiling / AI decisions" value={dataSharing.usedForProfiling.value} />
        </div>
        <div style={highlightStyle("usedToTrainAI")}>
          <PracticeRow label="Used to train AI models" value={dataSharing.usedToTrainAI.value} />
        </div>
        <div style={highlightStyle("disclosedToLawEnforcement")}>
          <PracticeRow label="Disclosed to law enforcement" value={dataSharing.disclosedToLawEnforcement.value} />
        </div>

        {/* Third-party recipients */}
        {(thirdPartyRecipients.categoryCount !== null || thirdPartyRecipients.categories.length > 0) && (
          <div style={{ fontSize: 11, color: COLOR.gray, paddingTop: 4, lineHeight: 1.5 }}>
            <span>Third-party categories: </span>
            <span style={{
              fontWeight: 700,
              color: (thirdPartyRecipients.categoryCount ?? 0) > 5 ? COLOR.red : COLOR.black,
            }}>
              {thirdPartyRecipients.categoryCount !== null ? thirdPartyRecipients.categoryCount : thirdPartyRecipients.categories.length}
            </span>
            {thirdPartyRecipients.categories.length > 0 && (
              <span style={{ color: COLOR.gray }}> ({thirdPartyRecipients.categories.slice(0, 4).join(", ")}
              {thirdPartyRecipients.categories.length > 4 ? ", …" : ""})</span>
            )}
          </div>
        )}
      </Section>

      <Rule weight="thick" />

      {/* ── Purposes ─────────────────────────────────────────────────────── */}
      {activePurposes.length > 0 && (
        <>
          <Section pb={2}>
            <SectionLabel>Data Uses</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
              {activePurposes.map((p) => (
                <span key={p.label} style={{
                  fontSize: 10,
                  backgroundColor: COLOR.grayLight,
                  color: p.label === "Advertising" || p.label === "Third-party partnerships" ? COLOR.red : COLOR.black,
                  padding: "2px 6px",
                  borderRadius: 10,
                  fontWeight: p.label === "Advertising" || p.label === "Third-party partnerships" ? 700 : 400,
                }}>
                  {p.label}
                </span>
              ))}
            </div>
          </Section>
          <Rule weight="thick" />
        </>
      )}

      {/* ── Retention ────────────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Data Retention</SectionLabel>
        <div style={{ ...highlightStyle("retention"), fontSize: 13, fontWeight: 700, color: retentionDisplay.color, paddingBottom: 2 }}>
          {retentionDisplay.text}
        </div>
        {retention.variesByDataType && (
          <div style={{ fontSize: 10, color: COLOR.gray }}>Varies by data type</div>
        )}
        {retention.legallyMandatedRetention && (
          <div style={{ fontSize: 10, color: COLOR.gray }}>Includes legally mandated retention</div>
        )}
        {retention.longestStatedPeriod && !["not stated", "not specified", "", "not disclosed", "unspecified"].includes(retention.longestStatedPeriod.toLowerCase()) && (
          <div style={{ fontSize: 10, color: COLOR.gray }}>{retention.summary.slice(0, 80)}{retention.summary.length > 80 ? "…" : ""}</div>
        )}
      </Section>

      <Rule weight="thick" />

      {/* ── Consumer Rights + Security (two columns) ─────────────────────── */}
      <Section>
        <div style={{ display: "flex", gap: 12 }}>
          {/* Rights column */}
          <div style={{ flex: 1 }}>
            <SectionLabel>Consumer Rights</SectionLabel>
            {rights.map((r) => (
              <div key={r.label} style={highlightStyle(`right_${r.label}`)}>
                <CheckItem label={r.label} checked={r.value} />
              </div>
            ))}
          </div>
          {/* Security column */}
          <div style={{ flex: 1, borderLeft: RULE.thin, paddingLeft: 12 }}>
            <SectionLabel>Security</SectionLabel>
            {securityItems.map((m) => (
              <div key={m.label} style={highlightStyle(`security_${m.label}`)}>
                <CheckItem label={m.label} checked={m.value} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Rule weight="thick" />

      {/* ── Privacy Signals ──────────────────────────────────────────────── */}
      <Section>
        <SectionLabel>Browser Privacy Signals</SectionLabel>
        <div style={{ ...highlightStyle("honorsBrowserPrivacySignals"), display: "flex", alignItems: "center", gap: 8 }}>
          <SignalStatusPill status={signalHonoring.honorsBrowserPrivacySignals} />
          <span style={{ fontSize: 12 }}>GPC / DNT</span>
        </div>
      </Section>

      {/* ── Supplementary ────────────────────────────────────────────────── */}
      {supplementary.independentAudits.value !== null && (
        <>
          <Rule weight="thinGray" />
          <Section pt={3} pb={3}>
            <div style={{ fontSize: 10, color: COLOR.gray, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckItem label="Independent security audits" checked={supplementary.independentAudits.value} />
            </div>
          </Section>
        </>
      )}

      <Rule weight="thin" />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Section pt={6} pb={6}>
        <div style={{ fontSize: 9, color: COLOR.gray, lineHeight: 1.5 }}>
          This label summarizes privacy practices as disclosed in the company's privacy policy.
          This is not legal advice.{" "}
          <a
            href={metadata.policyUrl}
            style={{ color: COLOR.gray, textDecoration: "underline" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Full policy ↗
          </a>
        </div>
      </Section>
    </div>
  );
}
