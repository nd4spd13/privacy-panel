"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { GradeBadge } from "@/components/GradeBadge";

// ── Rubric data (mirrors rubric.v2.yaml) ───────────────────────────────────
// effectivePoints = Math.round(points * tierWeight)

const DEDUCTIONS: Array<{
  key: string;
  label: string;
  effectivePoints: number;
  tier: "core" | "emerging";
  group: string;
  supersedesKey?: string; // this item is skipped if that key is checked
}> = [
  // Data Sharing — core
  { key: "soldToThirdParties",          label: "Data sold to third parties",                   effectivePoints: 25, tier: "core",     group: "Data Sharing" },
  { key: "sharedForAdvertising",        label: "Data shared for advertising",                  effectivePoints: 10, tier: "core",     group: "Data Sharing" },
  { key: "usedForProfiling",            label: "Used for profiling / automated decisions",     effectivePoints: 8,  tier: "core",     group: "Data Sharing" },
  { key: "disclosedToLawEnforcement",   label: "Disclosed to law enforcement",                 effectivePoints: 3,  tier: "core",     group: "Data Sharing" },
  { key: "crossSiteTracking",           label: "Cross-site tracking",                          effectivePoints: 5,  tier: "emerging", group: "Data Sharing" },
  // Data Collection — core
  { key: "collectsPreciseGeolocation",  label: "Collects precise geolocation",                 effectivePoints: 8,  tier: "core",     group: "Data Collection" },
  { key: "collectsBiometricData",       label: "Collects biometric data",                      effectivePoints: 8,  tier: "core",     group: "Data Collection" },
  { key: "collectsHealthData",          label: "Collects health data",                         effectivePoints: 5,  tier: "core",     group: "Data Collection" },
  { key: "collectsFinancialData",       label: "Collects financial data",                      effectivePoints: 3,  tier: "core",     group: "Data Collection" },
  // Third Parties — core, mutually exclusive tiers
  { key: "thirdPartyCategoriesOver5",   label: "More than 5 third-party recipient categories", effectivePoints: 8,  tier: "core",     group: "Third Parties" },
  { key: "thirdPartyCategories3To5",    label: "3–5 third-party recipient categories",         effectivePoints: 4,  tier: "core",     group: "Third Parties", supersedesKey: "thirdPartyCategoriesOver5" },
  { key: "thirdPartyIncludesAds",       label: "Third parties include advertising networks",   effectivePoints: 5,  tier: "core",     group: "Third Parties" },
  // Retention — core, mutually exclusive tiers
  { key: "retentionIndefinite",         label: "Retention is indefinite",                      effectivePoints: 10, tier: "core",     group: "Data Retention" },
  { key: "retentionNotStated",          label: "Retention period not disclosed",               effectivePoints: 8,  tier: "core",     group: "Data Retention", supersedesKey: "retentionIndefinite" },
  { key: "retentionOver3Years",         label: "Retention longer than 3 years",                effectivePoints: 5,  tier: "core",     group: "Data Retention", supersedesKey: "retentionIndefinite" },
  // Privacy Signals — emerging
  { key: "doesNotHonorBrowserSignals",  label: "Does not honor browser privacy signals (GPC/DNT)", effectivePoints: 3, tier: "emerging", group: "Privacy Signals" },
];

const GRADE_BANDS = [
  { letter: "A", min: 85, max: 100, label: "Excellent", bg: "bg-green-50 border-green-200",  text: "text-green-800" },
  { letter: "B", min: 70, max: 84,  label: "Good",      bg: "bg-lime-50 border-lime-200",    text: "text-lime-800" },
  { letter: "C", min: 55, max: 69,  label: "Fair",      bg: "bg-amber-50 border-amber-200",  text: "text-amber-800" },
  { letter: "D", min: 40, max: 54,  label: "Poor",      bg: "bg-orange-50 border-orange-200",text: "text-orange-800" },
  { letter: "F", min: 0,  max: 39,  label: "Failing",   bg: "bg-red-50 border-red-200",      text: "text-red-800" },
];

const GROUPS = Array.from(new Set(DEDUCTIONS.map((d) => d.group)));

function letterFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ── Page component ─────────────────────────────────────────────────────────

export default function RubricPage() {
  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const [rights, setRights]         = useState(0);
  const [security, setSecurity]     = useState(0);
  const [honorsSignals, setHonors]  = useState(false);
  const [aiOptOut, setAiOptOut]     = useState(false);
  const [audits, setAudits]         = useState(false);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  let deducted = 0;
  const activeDeductions: typeof DEDUCTIONS = [];

  for (const d of DEDUCTIONS) {
    if (!checked.has(d.key)) continue;
    // Skip if superseded by another checked item
    if (d.supersedesKey && checked.has(d.supersedesKey)) continue;
    deducted += d.effectivePoints;
    activeDeductions.push(d);
  }

  const rightsBonus    = Math.min(rights, 5) * 2;
  const securityBonus  = Math.min(security, 4) * 2;
  const signalsBonus   = honorsSignals ? 3 : 0;
  const aiBonus        = aiOptOut ? 3 : 0;
  const auditsBonus    = audits ? 2 : 0;
  const totalBonus     = rightsBonus + securityBonus + signalsBonus + aiBonus + auditsBonus;
  const rawScore       = 100 - deducted + totalBonus;
  const score          = Math.min(100, Math.max(0, rawScore));
  const letter         = letterFromScore(score);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Scoring Rubric v2</h1>
          <p className="text-gray-500 leading-relaxed max-w-2xl">
            Every score starts at 100. Deductions are applied for privacy-negative practices.
            Bonuses reward companies that proactively protect users.
            The rubric uses tiered weights: core practices apply fully; emerging practices apply at half weight.
            The rubric is deterministic — the same policy facts always produce the same score.
          </p>
          <a
            href="/rubric/v1.yaml"
            className="inline-block mt-4 text-sm text-gray-500 underline hover:text-gray-700"
            target="_blank"
          >
            Download rubric YAML ↗
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Simulator ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-5">
                Score Simulator
              </h2>
              <p className="text-xs text-gray-500 mb-5">
                Toggle practices to see how they affect the score. Emerging-tier items (½ weight) are marked with a badge.
              </p>

              {GROUPS.map((group) => (
                <div key={group} className="mb-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{group}</h3>
                  <div className="space-y-1">
                    {DEDUCTIONS.filter((d) => d.group === group).map((d) => {
                      const isActive = checked.has(d.key);
                      const isSuperseded = !!d.supersedesKey && checked.has(d.supersedesKey);
                      return (
                        <label
                          key={d.key}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer select-none transition-colors ${
                            isActive && !isSuperseded
                              ? "bg-red-50 border border-red-200"
                              : "hover:bg-gray-50 border border-transparent"
                          } ${isSuperseded ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => toggle(d.key)}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700">{d.label}</span>
                            {d.tier === "emerging" && (
                              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded">½ weight</span>
                            )}
                            {isSuperseded && (
                              <span className="text-xs text-gray-400 italic">(superseded)</span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-red-600 ml-4">−{d.effectivePoints}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Bonuses */}
              <div className="mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Bonuses</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-3">
                    <div>
                      <span className="text-sm text-gray-700">Consumer rights available</span>
                      <span className="text-xs text-gray-400 ml-2">(+2 each, max 5 = +10)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRights((r) => Math.max(0, r - 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">−</button>
                      <span className="w-5 text-center text-sm font-bold text-green-700">{Math.min(rights, 5)}</span>
                      <button onClick={() => setRights((r) => Math.min(5, r + 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">+</button>
                      <span className="text-sm font-semibold text-green-600 ml-2">+{rightsBonus}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3">
                    <div>
                      <span className="text-sm text-gray-700">Security measures</span>
                      <span className="text-xs text-gray-400 ml-2">(+2 each, max 4 = +8)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSecurity((s) => Math.max(0, s - 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">−</button>
                      <span className="w-5 text-center text-sm font-bold text-green-700">{Math.min(security, 4)}</span>
                      <button onClick={() => setSecurity((s) => Math.min(4, s + 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">+</button>
                      <span className="text-sm font-semibold text-green-600 ml-2">+{securityBonus}</span>
                    </div>
                  </div>
                  {[
                    { label: "Honors browser privacy signals (GPC/DNT)", value: honorsSignals, set: setHonors, bonus: signalsBonus, pts: 3 },
                    { label: "Does NOT use data for AI training (explicit)", value: aiOptOut, set: setAiOptOut, bonus: aiBonus, pts: 3 },
                    { label: "Independent security audits performed", value: audits, set: setAudits, bonus: auditsBonus, pts: 2 },
                  ].map(({ label, value, set, bonus, pts }) => (
                    <label key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer select-none transition-colors ${value ? "bg-green-50 border border-green-200" : "hover:bg-gray-50 border border-transparent"}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={value} onChange={() => set((v) => !v)} className="rounded" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600 ml-4">+{pts}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Live score ─────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center sticky top-20">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Live Score</div>
              <GradeBadge letter={letter} score={score} size="lg" />
              <div className="mt-4 text-4xl font-black text-gray-900">{score}</div>
              <div className="text-sm text-gray-400 mt-1">
                {score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 55 ? "Fair" : score >= 40 ? "Poor" : "Failing"}
              </div>

              {(activeDeductions.length > 0 || totalBonus > 0) && (
                <div className="mt-5 text-left space-y-1">
                  {activeDeductions.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Active deductions</div>
                      {activeDeductions.map((d) => (
                        <div key={d.key} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate mr-2">{d.label}</span>
                          <span className="text-red-600 font-semibold flex-shrink-0">−{d.effectivePoints}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {totalBonus > 0 && (
                    <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Active bonuses</div>
                      {rightsBonus > 0   && <div className="flex justify-between text-xs text-gray-600"><span>Consumer rights ({Math.min(rights,5)}×2)</span><span className="text-green-600 font-semibold">+{rightsBonus}</span></div>}
                      {securityBonus > 0 && <div className="flex justify-between text-xs text-gray-600"><span>Security measures ({Math.min(security,4)}×2)</span><span className="text-green-600 font-semibold">+{securityBonus}</span></div>}
                      {signalsBonus > 0  && <div className="flex justify-between text-xs text-gray-600"><span>Browser signals honored</span><span className="text-green-600 font-semibold">+{signalsBonus}</span></div>}
                      {aiBonus > 0       && <div className="flex justify-between text-xs text-gray-600"><span>AI training opt-out</span><span className="text-green-600 font-semibold">+{aiBonus}</span></div>}
                      {auditsBonus > 0   && <div className="flex justify-between text-xs text-gray-600"><span>Independent audits</span><span className="text-green-600 font-semibold">+{auditsBonus}</span></div>}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => { setChecked(new Set()); setRights(0); setSecurity(0); setHonors(false); setAiOptOut(false); setAudits(false); }}
                className="mt-5 text-xs text-gray-400 underline hover:text-gray-600"
              >
                Reset
              </button>
            </div>

            {/* Grade bands */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Grade Scale</div>
              <div className="space-y-2">
                {GRADE_BANDS.map((g) => (
                  <div
                    key={g.letter}
                    className={`flex items-center justify-between border rounded-lg px-3 py-2 ${g.bg} ${score >= g.min && score <= g.max ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${g.text}`}>{g.letter}</span>
                      <span className={`text-sm font-semibold ${g.text}`}>{g.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{g.min}–{g.max}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Methodology notes ──────────────────────────────────────────── */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">How we grade</h3>
            <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <li>Every company starts at a score of <strong>100</strong>.</li>
              <li><strong>Core</strong> practices (weight 1.0) deduct their full listed points.</li>
              <li><strong>Emerging</strong> practices (weight 0.5) deduct half their listed points.</li>
              <li>Bonuses reward companies that proactively protect users.</li>
              <li>Mutually exclusive deductions (e.g., retention) only apply the highest tier.</li>
              <li>The final score is clamped to the range 0–100.</li>
            </ul>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Null / unknown fields</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              When a policy is silent on a practice, each field has a configured <em>null behavior</em>:
              <strong> full</strong> applies the full deduction, <strong>half</strong> applies half,
              <strong> skip</strong> applies none.
              High-stakes fields like data sales use <em>half</em> deduction when silent;
              optional fields like geolocation use <em>skip</em>.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Rubric versioning</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              The rubric is versioned. All analyses record which rubric version was used. When the
              rubric changes, existing analyses are <em>not</em> retroactively re-scored — you can
              always reproduce any historical grade from the archived rubric and the stored extraction.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Limitations</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Grades reflect <em>disclosed</em> practices, not actual behavior. A company with an
              excellent privacy policy may still violate it. The grade measures transparency and
              disclosed practices, not a guarantee of privacy.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
