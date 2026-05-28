"use client";

import { useState } from "react";

const GRADE_BG: Record<string, string> = {
  A: "bg-green-700",
  B: "bg-lime-700",
  C: "bg-amber-600",
  D: "bg-orange-700",
  F: "bg-red-700",
};

interface CompanyResult {
  company: { slug: string; name: string; domain: string | null };
  grade: { letter: string; score: number; label: string };
  facts: Record<string, unknown>;
}

export default function CompareClient({ showGrades = false }: { showGrades?: boolean }) {
  const [slugInput, setSlugInput] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ slug: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  async function searchCompanies(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.results ?? []);
    } catch { /* ignore */ }
  }

  function addSlug(slug: string, name?: string) {
    if (selected.length >= 3) {
      setError("You can compare up to 3 companies at a time.");
      return;
    }
    if (selected.includes(slug)) return;
    setSelected((prev) => [...prev, slug]);
    setSuggestions([]);
    setSearchQuery("");
    setSlugInput("");
    setError(null);
  }

  function removeSlug(slug: string) {
    setSelected((prev) => prev.filter((s) => s !== slug));
    setResults((prev) => prev.filter((r) => r.company.slug !== slug));
    setError(null);
  }

  async function runComparison() {
    if (selected.length < 2) {
      setError("Select at least 2 companies to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/compare?slugs=${selected.join(",")}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to fetch comparison data.");
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const hasResults = results.length >= 2;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-black text-gray-900 mb-2">Compare Companies</h1>
      <p className="text-sm text-gray-400 mb-8">Select 2–3 companies to compare their privacy practices side by side.</p>

      {/* ── Company picker ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex flex-wrap gap-3 mb-4">
          {selected.map((slug) => {
            const r = results.find((r) => r.company.slug === slug);
            return (
              <div
                key={slug}
                className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800"
              >
                {r && showGrades && (
                <div className={`${GRADE_BG[r.grade.letter] ?? "bg-gray-500"} w-8 h-8 text-base rounded-full flex items-center justify-center text-white font-black flex-shrink-0`}>
                  {r.grade.letter}
                </div>
              )}
                <span>{r ? r.company.name : slug}</span>
                <button
                  onClick={() => removeSlug(slug)}
                  className="ml-1 text-gray-400 hover:text-gray-700 text-base leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
          {selected.length < 3 && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchCompanies(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    addSlug(searchQuery.trim().toLowerCase().replace(/\s+/g, "-"));
                  }
                }}
                placeholder="Add a company…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => addSlug(s.slug, s.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-800"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={runComparison}
            disabled={selected.length < 2 || loading}
            className="bg-black text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Compare"}
          </button>
          {selected.length < 2 && (
            <span className="text-xs text-gray-400">Add {2 - selected.length} more to compare</span>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {hasResults && (
        <div>
          {/* Summary row */}
          <div className="flex gap-6 mb-8 overflow-x-auto pb-2">
            {results.map((r) => (
              <a
                key={r.company.slug}
                href={`/company/${r.company.slug}`}
                className="flex-shrink-0 flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 transition-all"
              >
                {showGrades && (
                  <div className={`${GRADE_BG[r.grade.letter] ?? "bg-gray-500"} w-12 h-12 text-2xl rounded-full flex items-center justify-center text-white font-black flex-shrink-0`}>
                    {r.grade.letter}
                  </div>
                )}
                <div>
                  <div className="font-bold text-gray-900">{r.company.name}</div>
                  {showGrades && <div className="text-sm text-gray-400">{r.grade.score}/100 · {r.grade.label}</div>}
                </div>
              </a>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <ComparisonTable results={results} />
          </div>
        </div>
      )}
    </main>
  );
}

interface FactRow {
  label: string;
  get: (r: CompanyResult) => boolean | string | null;
  type: "boolean" | "text";
  badWhenTrue?: boolean;
}

const ROWS: FactRow[] = [
  { label: "Sold to third parties", get: (r) => (r.facts as any).dataSharing?.soldToThirdParties?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Shared for advertising", get: (r) => (r.facts as any).dataSharing?.sharedForAdvertising?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Cross-site tracking", get: (r) => (r.facts as any).dataSharing?.crossSiteTracking?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Used for profiling", get: (r) => (r.facts as any).dataSharing?.usedForProfiling?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Used to train AI", get: (r) => (r.facts as any).dataSharing?.usedToTrainAI?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Collects geolocation", get: (r) => (r.facts as any).dataCollection?.collectsPreciseGeolocation?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Collects biometrics", get: (r) => (r.facts as any).dataCollection?.collectsBiometricData?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Collects health data", get: (r) => (r.facts as any).dataCollection?.collectsHealthData?.value ?? false, type: "boolean", badWhenTrue: true },
  { label: "Honors GPC", get: (r) => (r.facts as any).signalHonoring?.honorsGPC?.value ?? false, type: "boolean", badWhenTrue: false },
  { label: "Honors DNT", get: (r) => (r.facts as any).signalHonoring?.honorsDNT?.value ?? false, type: "boolean", badWhenTrue: false },
  { label: "Right to access", get: (r) => (r.facts as any).consumerRights?.rightToAccess?.value ?? false, type: "boolean", badWhenTrue: false },
  { label: "Right to delete", get: (r) => (r.facts as any).consumerRights?.rightToDelete?.value ?? false, type: "boolean", badWhenTrue: false },
  { label: "Right to portability", get: (r) => (r.facts as any).consumerRights?.rightToPortability?.value ?? false, type: "boolean", badWhenTrue: false },
  { label: "Right to opt-out", get: (r) => (r.facts as any).consumerRights?.rightToOptOut?.value ?? false, type: "boolean", badWhenTrue: false },
];

function ComparisonTable({ results }: { results: CompanyResult[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-48">Practice</th>
          {results.map((r) => (
            <th key={r.company.slug} className="px-4 py-3 text-center text-sm font-bold text-gray-900">
              {r.company.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => {
          const values = results.map((r) => row.get(r));
          const allSame = values.every((v) => v === values[0]);
          return (
            <tr key={row.label} className={`border-b border-gray-50 last:border-b-0 ${!allSame ? "bg-amber-50" : ""}`}>
              <td className="px-4 py-3 text-gray-600 font-medium">
                {row.label}
                {!allSame && <span className="ml-1.5 text-amber-600 text-xs">●</span>}
              </td>
              {results.map((r) => {
                const val = row.get(r);
                if (typeof val === "boolean") {
                  const isBad = row.badWhenTrue ? val : !val;
                  return (
                    <td key={r.company.slug} className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        val
                          ? isBad ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          : isBad ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {val ? "YES" : "no"}
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={r.company.slug} className="px-4 py-3 text-center text-gray-700">
                    {val ?? "—"}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
