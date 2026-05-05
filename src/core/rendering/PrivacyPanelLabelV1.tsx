/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * V1 Privacy Panel label — archived for comparison purposes.
 * Reads from the v1 schema shape (retention.retentionDays, signalHonoring.honorsGPC, etc.)
 * Uses `any` intentionally since v1 types are no longer in the live codebase.
 */
import React from "react";

const W = 380;

const COLOR = {
  black: "#000000",
  white: "#ffffff",
  red: "#b91c1c",
  green: "#15803d",
  gray: "#6b7280",
  border: "#000000",
};

const RULE = {
  thick: "7px solid #000",
  thin: "0.5px solid #000",
  thinGray: "0.5px solid #d1d5db",
};

function Rule({ weight = "thin" }: { weight?: "thick" | "thin" | "thinGray" }) {
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

function YesBadge({ critical = false }: { critical?: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      backgroundColor: critical ? COLOR.red : COLOR.black,
      color: COLOR.white,
      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
      padding: "2px 6px", borderRadius: 3,
      fontFamily: "Arial, Helvetica, sans-serif",
      minWidth: 32, textAlign: "center",
    }}>YES</span>
  );
}

function NoBadge() {
  return (
    <span style={{
      display: "inline-block",
      backgroundColor: "transparent", color: COLOR.gray,
      fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
      padding: "2px 6px", border: `0.5px solid ${COLOR.gray}`,
      borderRadius: 3, fontFamily: "Arial, Helvetica, sans-serif",
      minWidth: 32, textAlign: "center",
    }}>no</span>
  );
}

function PracticeRow({ label, value, critical = false }: { label: string; value: boolean; critical?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 3, paddingBottom: 3 }}>
      {value ? <YesBadge critical={critical} /> : <NoBadge />}
      <span style={{ fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: value ? 600 : 400, color: value && critical ? COLOR.red : COLOR.black }}>
        {label}
      </span>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 2, paddingBottom: 2 }}>
      <div style={{
        width: 12, height: 12,
        border: `1.5px solid ${checked ? COLOR.green : COLOR.gray}`,
        borderRadius: 2,
        backgroundColor: checked ? COLOR.green : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif", color: COLOR.black }}>{label}</span>
    </div>
  );
}

function SignalPill({ label, honored }: { label: string; honored: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        display: "inline-block",
        backgroundColor: honored ? COLOR.green : COLOR.red,
        color: COLOR.white, fontSize: 9, fontWeight: 700,
        padding: "2px 6px", borderRadius: 10, letterSpacing: "0.04em",
      }}>
        {honored ? "honored" : "not honored"}
      </span>
      <span style={{ fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif" }}>{label}</span>
    </div>
  );
}

export function PrivacyPanelLabelV1({ data }: { data: any }) {
  const { dataCollection, dataSharing, retention, consumerRights, signalHonoring, security, metadata } = data;

  const retentionLabel = (() => {
    if (retention.indefinite) return { text: "Indefinite", color: COLOR.red };
    if (retention.retentionDays === null) return { text: "Not specified", color: COLOR.gray };
    const days = retention.retentionDays;
    if (days <= 90) return { text: `${days} days`, color: COLOR.green };
    if (days <= 365) return { text: `${days} days`, color: COLOR.black };
    const years = (days / 365).toFixed(1).replace(/\.0$/, "");
    return { text: `${years} years`, color: days > 365 * 3 ? COLOR.red : COLOR.black };
  })();

  const rights = [
    { label: "Access", value: consumerRights.rightToAccess.value },
    { label: "Delete", value: consumerRights.rightToDelete.value },
    { label: "Portability", value: consumerRights.rightToPortability.value },
    { label: "Correct", value: consumerRights.rightToCorrect.value },
    { label: "Opt-out", value: consumerRights.rightToOptOut.value },
    { label: "Non-discrimination", value: consumerRights.rightToNonDiscrimination.value },
  ];

  const measures = (security.measures ?? []).slice(0, 6);

  return (
    <div style={{
      width: W,
      border: `2.5px solid ${COLOR.border}`,
      fontFamily: "Arial, Helvetica, sans-serif",
      backgroundColor: COLOR.white,
      boxSizing: "border-box",
    }}>
      {/* Title */}
      <div style={{ padding: "8px 8px 6px 8px", borderBottom: RULE.thick }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05 }}>Privacy Panel</div>
        <div style={{ fontSize: 12, color: COLOR.gray, marginTop: 2 }}>{metadata.companyName}</div>
      </div>

      {/* Data Collected */}
      <Section pt={6} pb={2}>
        <SectionLabel>Data Collected</SectionLabel>
        {(dataCollection.items ?? []).length === 0 ? (
          <div style={{ fontSize: 12, color: COLOR.gray, paddingBottom: 4 }}>None disclosed</div>
        ) : (
          (dataCollection.items as any[]).map((item: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ color: item.sensitive ? COLOR.red : COLOR.gray, fontSize: 10, lineHeight: 1 }}>
                {item.sensitive ? "●" : "○"}
              </span>
              <span style={{ fontSize: 12, color: item.sensitive ? COLOR.red : COLOR.black, fontWeight: item.sensitive ? 600 : 400 }}>
                {item.name}
              </span>
              {item.sensitive && (
                <span style={{ fontSize: 9, color: COLOR.red, fontWeight: 600, marginLeft: 2 }}>sensitive</span>
              )}
            </div>
          ))
        )}
      </Section>

      <Rule weight="thick" />

      {/* Data Sharing */}
      <Section>
        <SectionLabel>Data Sharing &amp; Use</SectionLabel>
        <PracticeRow label="Sold to third parties" value={dataSharing.soldToThirdParties.value} critical />
        <PracticeRow label="Shared for advertising" value={dataSharing.sharedForAdvertising.value} />
        <PracticeRow label="Cross-site tracking" value={dataSharing.crossSiteTracking.value} />
        <PracticeRow label="Used for profiling / AI decisions" value={dataSharing.usedForProfiling.value} />
        <PracticeRow label="Used to train AI models" value={dataSharing.usedToTrainAI.value} />
        {dataSharing.thirdPartyCount !== null && (
          <div style={{ fontSize: 11, color: COLOR.gray, paddingTop: 4 }}>
            Third parties: <span style={{ fontWeight: 700, color: dataSharing.thirdPartyCount > 10 ? COLOR.red : COLOR.black }}>{dataSharing.thirdPartyCount}</span>
          </div>
        )}
      </Section>

      <Rule weight="thick" />

      {/* Retention */}
      <Section>
        <SectionLabel>Data Retention</SectionLabel>
        <div style={{ fontSize: 13, fontWeight: 700, color: retentionLabel.color, paddingBottom: 2 }}>
          {retentionLabel.text}
        </div>
        {retention.retentionDays !== null && !retention.indefinite && (
          <div style={{ fontSize: 10, color: COLOR.gray }}>
            {String(retention.sourceQuote ?? "").slice(0, 80)}{String(retention.sourceQuote ?? "").length > 80 ? "…" : ""}
          </div>
        )}
      </Section>

      <Rule weight="thick" />

      {/* Consumer Rights + Security */}
      <Section>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <SectionLabel>Consumer Rights</SectionLabel>
            {rights.map((r) => <CheckItem key={r.label} label={r.label} checked={r.value} />)}
          </div>
          <div style={{ flex: 1, borderLeft: RULE.thin, paddingLeft: 12 }}>
            <SectionLabel>Security</SectionLabel>
            {measures.length === 0 ? (
              <div style={{ fontSize: 11, color: COLOR.gray }}>None disclosed</div>
            ) : (
              measures.map((m: any, i: number) => <CheckItem key={i} label={m.name} checked />)
            )}
          </div>
        </div>
      </Section>

      <Rule weight="thick" />

      {/* Privacy Signals */}
      <Section>
        <SectionLabel>Privacy Signals</SectionLabel>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <SignalPill label="GPC" honored={signalHonoring.honorsGPC?.value ?? false} />
          <SignalPill label="DNT" honored={signalHonoring.honorsDNT?.value ?? false} />
        </div>
      </Section>

      <Rule weight="thin" />

      {/* Footer */}
      <Section pt={6} pb={6}>
        <div style={{ fontSize: 9, color: COLOR.gray, lineHeight: 1.5 }}>
          This label summarizes privacy practices as disclosed in the company&apos;s privacy policy.
          This is not legal advice.{" "}
          <a href={metadata.policyUrl} style={{ color: COLOR.gray, textDecoration: "underline" }} target="_blank" rel="noopener noreferrer">
            Full policy ↗
          </a>
        </div>
      </Section>
    </div>
  );
}
