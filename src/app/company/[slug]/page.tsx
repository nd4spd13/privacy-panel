import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { GradedLabel } from "@/core/rendering/GradedLabel";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { FEATURE_DISPUTES } from "@/lib/flags";

export const dynamic = "force-dynamic";

export default function CompanyPage({ params }: { params: { slug: string } }) {
  const company = getCompanyBySlug(params.slug);
  if (!company) notFound();

  const extraction = getLatestExtractionForCompany(company.id);
  if (!extraction) notFound();

  const { facts, grade } = extraction;
  const bd = grade.breakdown;

  const deductions = bd.filter((b) => b.triggered && b.points < 0);
  const bonuses = bd.filter((b) => b.triggered && b.points > 0);

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
        <div className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/directory" className="hover:text-gray-700">Directory</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{company.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          {/* ── Left: Label ──────────────────────────────────────────────── */}
          <div className="flex-shrink-0">
            <GradedLabel data={facts} grade={grade} />
            <div className="mt-4 flex gap-2 text-xs">
              <a
                href={`/api/v1/company/${company.slug}/label`}
                target="_blank"
                className="text-gray-500 hover:text-gray-800 underline"
              >
                Download SVG
              </a>
              <span className="text-gray-300">·</span>
              <a
                href={`/api/v1/company/${company.slug}/label?format=html`}
                target="_blank"
                className="text-gray-500 hover:text-gray-800 underline"
              >
                Download HTML
              </a>
              <span className="text-gray-300">·</span>
              <Link href={`/compare?slugs=${company.slug}`} className="text-gray-500 hover:text-gray-800 underline">
                Compare
              </Link>
            </div>
          </div>

          {/* ── Right: Details ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-gray-900 mb-1">{company.name}</h1>
            {company.domain && (
              <a href={`https://${company.domain}`} target="_blank" className="text-sm text-gray-400 hover:text-gray-700">
                {company.domain} ↗
              </a>
            )}

            {/* Score breakdown */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Score Breakdown</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-600">Starting score</span>
                  <span className="text-sm font-bold text-gray-900">100</span>
                </div>

                {deductions.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Deductions</span>
                    </div>
                    {deductions.map((b) => (
                      <div key={b.key} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-800">{b.label}</span>
                          {b.detail && <span className="text-xs text-gray-400 ml-2">({b.detail})</span>}
                        </div>
                        <span className="text-sm font-semibold text-red-600 flex-shrink-0 ml-4">{b.points}</span>
                      </div>
                    ))}
                  </>
                )}

                {bonuses.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Bonuses</span>
                    </div>
                    {bonuses.map((b) => (
                      <div key={b.key} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-800">{b.label}</span>
                          {b.detail && <span className="text-xs text-gray-400 ml-2">({b.detail})</span>}
                        </div>
                        <span className="text-sm font-semibold text-green-600 flex-shrink-0 ml-4">+{b.points}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-900">Final score</span>
                  <span className="text-lg font-black text-gray-900">{grade.score}/100</span>
                </div>
              </div>
            </div>

            {/* Source quotes */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Source Evidence</h2>
              <div className="space-y-3">
                {[
                  { label: "Sold to third parties", field: facts.dataSharing.soldToThirdParties },
                  { label: "Shared for advertising", field: facts.dataSharing.sharedForAdvertising },
                  { label: "Cross-site tracking", field: facts.dataSharing.crossSiteTracking },
                  { label: "Used for profiling", field: facts.dataSharing.usedForProfiling },
                  { label: "Used to train AI", field: facts.dataSharing.usedToTrainAI },
                  { label: "Honors GPC", field: facts.signalHonoring.honorsGPC },
                  { label: "Honors DNT", field: facts.signalHonoring.honorsDNT },
                ].map(({ label, field }) => (
                  <div key={label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${field.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                          {field.value ? "YES" : "no"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {Math.round(field.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <blockquote className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3 leading-relaxed">
                      {field.sourceQuote}
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis metadata */}
            <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              <p>Analyzed {new Date(extraction.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <p>Model: {extraction.model} · {extraction.input_tokens?.toLocaleString()} input tokens</p>
              <p>Rubric version {grade.rubricVersion} · <Link href="/rubric" className="underline hover:text-gray-600">View full rubric</Link></p>
            </div>

            {/* Dispute */}
            {FEATURE_DISPUTES && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Dispute this analysis</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  If you represent {company.name} and believe a finding is inaccurate, you can submit a dispute with
                  supporting evidence. We review all disputes and update analyses when warranted.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
