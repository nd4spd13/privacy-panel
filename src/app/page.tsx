import Link from "next/link";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { CompanyCard } from "@/components/CompanyCard";
import { countCompanies } from "@/db/companies";
import { listHomePageMix } from "@/db/extractions";
import { scoresEnabled } from "@/lib/flags";

export const revalidate = 60;

export default function Home() {
  const showGrades = scoresEnabled();
  const recent = listHomePageMix(6);
  const totalCount = countCompanies();

  return (
    <>
      <Header />
      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-6 py-20 text-center">
            <h1 className="text-5xl font-black text-gray-900 leading-tight tracking-tight mb-5">
              Privacy labels for<br />every company.
            </h1>
            <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
              {showGrades
                ? "One label and one grade. Read a privacy policy in 30 seconds instead of 30 pages."
                : "Read a privacy policy in 30 seconds instead of 30 pages."}
            </p>
            <div className="max-w-lg mx-auto">
              <SearchBar
                placeholder="Search a company (e.g. Signal, Google, Meta…)"
                size="large"
              />
            </div>
            {totalCount > 0 && (
              <p className="text-sm text-gray-400 mt-4">
                {totalCount.toLocaleString()} {totalCount === 1 ? "company" : "companies"} analyzed to date
              </p>
            )}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="bg-gray-50 border-b border-gray-100 py-16">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-10 text-center">How it works</h2>
            <div className={showGrades ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" : "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8"}>
              {[
                {
                  step: "1",
                  title: "We fetch the policy",
                  body: "We download the company's public privacy policy and extract the plain text.",
                },
                {
                  step: "2",
                  title: "AI extracts the facts",
                  body: "An AI extraction model reads the policy and extracts structured data — what's collected, shared, and for how long — with source quotes for every finding.",
                },
                {
                  step: "3",
                  title: "We render the label",
                  body: "We render the facts into a standardized Privacy Panel label, modeled on FDA Nutrition Facts. Same format for every company so you can compare directly.",
                },
                ...(showGrades ? [{
                  step: "4",
                  title: "We score it against the rubric",
                  body: "We apply a published, deterministic rubric to the facts and produce a letter grade (A–F). Every point added or deducted is visible and reproducible.",
                }] : []),
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center text-lg font-black mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recent analyses ───────────────────────────────────────────────── */}
        {recent.length > 0 && (
          <section className="py-16">
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-gray-900">Recent analyses</h2>
                <Link href="/directory" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recent.map(({ company, grade }) => (
                  <CompanyCard
                    key={company.slug}
                    slug={company.slug}
                    name={company.name}
                    score={grade.score}
                    letter={grade.letter}
                    label={grade.label}
                    showGrade={showGrades}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Grade scale explainer ──────────────────────────────────────────── */}
        {showGrades && (
          <section className="bg-gray-50 border-t border-gray-100 py-16">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">The grading scale</h2>
              <p className="text-gray-500 text-sm mb-8">Scores run 0–100 based on our <Link href="/rubric" className="underline">published rubric</Link>.</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { letter: "A", range: "85–100", label: "Excellent", bg: "bg-green-50 border-green-200", text: "text-green-800" },
                  { letter: "B", range: "70–84", label: "Good", bg: "bg-lime-50 border-lime-200", text: "text-lime-800" },
                  { letter: "C", range: "55–69", label: "Fair", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
                  { letter: "D", range: "40–54", label: "Poor", bg: "bg-orange-50 border-orange-200", text: "text-orange-800" },
                  { letter: "F", range: "0–39", label: "Failing", bg: "bg-red-50 border-red-200", text: "text-red-800" },
                ].map((g) => (
                  <div key={g.letter} className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${g.bg}`}>
                    <span className={`text-2xl font-black ${g.text}`}>{g.letter}</span>
                    <div>
                      <div className={`text-sm font-semibold ${g.text}`}>{g.label}</div>
                      <div className="text-xs text-gray-500">{g.range} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
