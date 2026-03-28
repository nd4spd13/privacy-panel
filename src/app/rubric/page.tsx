"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { GradeBadge } from "@/components/GradeBadge";

// ── Rubric data (mirrors rubric.v1.yaml) ───────────────────────────────────

const DEDUCTIONS: Array<{ key: string; label: string; points: number; group: string }> = [
  { key: "soldToThirdParties", label: "Data sold to third parties", points: 25, group: "Data Sharing" },
  { key: "sharedForAdvertising", label: "Data shared for advertising", points: 10, group: "Data Sharing" },
  { key: "crossSiteTracking", label: "Cross-site tracking", points: 10, group: "Data Sharing" },
  { key: "usedForProfiling", label: "Used for profiling / AI decisions", points: 8, group: "Data Sharing" },
  { key: "usedToTrainAI", label: "Used to train AI models", points: 8, group: "Data Sharing" },
  { key: "collectsPreciseGeolocation", label: "Collects precise geolocation", points: 8, group: "Data Collection" },
  { key: "collectsBiometricData", label: "Collects biometric data", points: 8, group: "Data Collection" },
  { key: "collectsHealthData", label: "Collects health data", points: 5, group: "Data Collection" },
  { key: "collectsFinancialData", label: "Collects financial data", points: 3, group: "Data Collection" },
  { key: "doesNotHonorGPC", label: "Does not honor GPC", points: 5, group: "Privacy Signals" },
  { key: "doesNotHonorDNT", label: "Does not honor DNT", points: 2, group: "Privacy Signals" },
  { key: "thirdPartiesOver10", label: "More than 10 third parties", points: 10, group: "Third Parties" },
  { key: "thirdParties6To10", label: "6–10 third parties (if not >10)", points: 5, group: "Third Parties" },
  { key: "retentionIndefinite", label: "Retention is indefinite", points: 10, group: "Data Retention" },
  { key: "retentionOver3Years", label: "Retention longer than 3 years (if not indefinite)", points: 8, group: "Data Retention" },
  { key: "retentionOver1Year", label: "Retention longer than 1 year (if not >3yr)", points: 3, group: "Data Retention" },
];

const GRADE_BANDS = [
  { letter: "A", min: 85, max: 100, label: "Excellent", bg: "bg-green-50 border-green-200", text: "text-green-800" },
  { letter: "B", min: 70, max: 84, label: "Good", bg: "bg-lime-50 border-lime-200", text: "text-lime-800" },
  { letter: "C", min: 55, max: 69, label: "Fair", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  { letter: "D", min: 40, max: 54, label: "Poor", bg: "bg-orange-50 border-orange-200", text: "text-orange-800" },
  { letter: "F", min: 0, max: 39, label: "Failing", bg: "bg-red-50 border-red-200", text: "text-red-800" },
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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rights, setRights] = useState(0);
  const [security, setSecurity] = useState(0);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Compute score with tier logic
  let deducted = 0;
  const activeDeductions: typeof DEDUCTIONS = [];
  for (const d of DEDUCTIONS) {
    if (!checked.has(d.key)) continue;
    // Third-party tiers: only highest applies
    if (d.key === "thirdParties6To10" && checked.has("thirdPartiesOver10")) continue;
    // Retention tiers: only highest applies
    if (d.key === "retentionOver3Years" && checked.has("retentionIndefinite")) continue;
    if (d.key === "retentionOver1Year" && (checked.has("retentionIndefinite") || checked.has("retentionOver3Years"))) continue;
    deducted += d.points;
    activeDeductions.push(d);
  }
  const rightsBonus = Math.min(rights, 6) * 2;
  const securityBonus = Math.min(security, 5) * 2;
  const rawScore = 100 - deducted + rightsBonus + securityBonus;
  const score = Math.min(100, Math.max(0, rawScore));
  const letter = letterFromScore(score);

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Scoring Rubric v1</h1>
          <p className="text-gray-500 leading-relaxed max-w-2xl">
            Every score starts at 100 and deductions are applied for privacy-negative practices.
            Bonuses are awarded for consumer rights and documented security measures.
            The rubric is deterministic: the same policy facts always produce the same score.
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
                Toggle practices to see how they affect the score in real time.
              </p>

              {GROUPS.map((group) => (
                <div key={group} className="mb-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{group}</h3>
                  <div className="space-y-1">
                    {DEDUCTIONS.filter((d) => d.group === group).map((d) => {
                      const isActive = checked.has(d.key);
                      const isSuperseded =
                        (d.key === "thirdParties6To10" && checked.has("thirdPartiesOver10")) ||
                        (d.key === "retentionOver3Years" && checked.has("retentionIndefinite")) ||
                        (d.key === "retentionOver1Year" &&
                          (checked.has("retentionIndefinite") || checked.has("retentionOver3Years")));
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
                            {isSuperseded && (
                              <span className="text-xs text-gray-400 italic">(superseded)</span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-red-600 ml-4">−{d.points}</span>
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
                      <span className="text-xs text-gray-400 ml-2">(+2 each, max 6 × +2 = +12)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRights((r) => Math.max(0, r - 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">−</button>
                      <span className="w-5 text-center text-sm font-bold text-green-700">{Math.min(rights, 6)}</span>
                      <button onClick={() => setRights((r) => Math.min(6, r + 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">+</button>
                      <span className="text-sm font-semibold text-green-600 ml-2">+{rightsBonus}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3">
                    <div>
                      <span className="text-sm text-gray-700">Security measures</span>
                      <span className="text-xs text-gray-400 ml-2">(+2 each, max 5 × +2 = +10)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSecurity((s) => Math.max(0, s - 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">−</button>
                      <span className="w-5 text-center text-sm font-bold text-green-700">{Math.min(security, 5)}</span>
                      <button onClick={() => setSecurity((s) => Math.min(5, s + 1))} className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold">+</button>
                      <span className="text-sm font-semibold text-green-600 ml-2">+{securityBonus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Live score ─────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Score card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center sticky top-20">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Live Score</div>
              <GradeBadge letter={letter} score={score} size="lg" />
              <div className="mt-4 text-4xl font-black text-gray-900">{score}</div>
              <div className="text-sm text-gray-400 mt-1">{letterFromScore(score) === "A" ? "Excellent" : letterFromScore(score) === "B" ? "Good" : letterFromScore(score) === "C" ? "Fair" : letterFromScore(score) === "D" ? "Poor" : "Failing"}</div>

              {activeDeductions.length > 0 && (
                <div className="mt-5 text-left space-y-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Active deductions</div>
                  {activeDeductions.map((d) => (
                    <div key={d.key} className="flex justify-between text-xs text-gray-600">
                      <span className="truncate mr-2">{d.label}</span>
                      <span className="text-red-600 font-semibold flex-shrink-0">−{d.points}</span>
                    </div>
                  ))}
                  {(rightsBonus > 0 || securityBonus > 0) && (
                    <>
                      <div className="border-t border-gray-100 pt-1 mt-1">
                        {rightsBonus > 0 && (
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Consumer rights</span>
                            <span className="text-green-600 font-semibold">+{rightsBonus}</span>
                          </div>
                        )}
                        {securityBonus > 0 && (
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Security measures</span>
                            <span className="text-green-600 font-semibold">+{securityBonus}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => { setChecked(new Set()); setRights(0); setSecurity(0); }}
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
              <li>Deductions are applied for practices that harm consumer privacy.</li>
              <li>Bonuses reward companies that proactively protect users.</li>
              <li>Tiered deductions (e.g., retention periods) only apply the largest matching tier.</li>
              <li>The final score is clamped to the range 0–100.</li>
            </ul>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Conservative defaults</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              When a privacy policy is silent or ambiguous on a practice, we apply the
              consumer-unfavorable interpretation. A company that does not explicitly state it
              <em> does not</em> sell data will be treated as if it does. This conservative
              default is disclosed in the source evidence for each finding.
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
              excellent privacy policy may still violate it; a company that discloses aggressive
              practices may still be a better choice than one that discloses nothing. The grade
              is a measure of transparency and disclosed practices, not a guarantee.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
