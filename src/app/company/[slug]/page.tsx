import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { GradeBadge } from "@/components/GradeBadge";
import { LabelScaler } from "@/components/LabelScaler";
import { PrivacyPanelLabel } from "@/core/rendering/PrivacyPanelLabel";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { PlausibleEvent } from "@/components/PlausibleEvent";

export const revalidate = 300;

function EvidenceCard({
  label,
  field,
  companyName,
}: {
  label: string;
  field: { value: boolean | null; confidence: number; sourceQuote: string };
  companyName: string;
}) {
  const isInferred = /does not mention|no mention|no explicit mention|policy is silent|not stated|not specified|not addressed|silent on this/i.test(
    field.sourceQuote
  );
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${field.value === true ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
            {field.value === true ? "YES" : field.value === null ? "?" : "no"}
          </span>
          <span className="text-xs text-gray-400">{Math.round(field.confidence * 100)}% confidence</span>
        </div>
      </div>
      {isInferred ? (
        <p className="text-xs text-gray-400 leading-relaxed">(policy is silent on this)</p>
      ) : (
        <blockquote className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3 leading-relaxed">
          {field.sourceQuote}
        </blockquote>
      )}
      <div className="mt-2 text-right">
        <a
          href={`mailto:hello@privacypanel.org?subject=${encodeURIComponent(`Issue with ${companyName} — ${label}`)}&body=${encodeURIComponent(`Quote: "${field.sourceQuote}"\n\nYour observation:`)}`}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          Dispute this finding →
        </a>
      </div>
    </div>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);
  if (!company) notFound();

  const extraction = getLatestExtractionForCompany(company.id);
  if (!extraction) notFound();

  const { facts, grade } = extraction;
  const bd = grade.breakdown;

  const nameMatch = company.name.match(/^(.+?)\s*\(([^()]+(?:\([^()]+\))*[^()]*)\)\s*$/);
  const displayName = nameMatch ? nameMatch[1].trim() : company.name;
  const parentCompany = nameMatch ? nameMatch[2].trim() : null;
  const showParent = parentCompany !== null && parentCompany !== displayName;

  const deductions = bd.filter((b) => b.triggered && b.points < 0);
  const bonuses = bd.filter((b) => b.triggered && b.points > 0);

  return (
    <>
      <PlausibleEvent name="View Company" props={{ company: company.name }} />
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
        <div className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/directory" className="hover:text-gray-700">Directory</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{displayName}</span>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-1">{displayName}</h1>
        {showParent && (
          <p className="text-sm text-gray-500 mt-1">Owned by {parentCompany}</p>
        )}
        {company.domain && (
          <a href={`https://${company.domain}`} target="_blank" className="text-sm text-gray-400 hover:text-gray-700">
            {company.domain} ↗
          </a>
        )}

        <div className="flex flex-col lg:flex-row gap-10 items-start mt-8">
          {/* ── Left: Neutral Privacy Panel Label ────────────────────────── */}
          <div className="w-full lg:w-auto lg:flex-shrink-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Privacy Panel Label</div>
            <LabelScaler labelWidth={480}>
              <PrivacyPanelLabel data={facts} width={480} />
            </LabelScaler>
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
            <p className="mt-3 text-xs text-gray-400 leading-relaxed max-w-[480px]">
              This label summarizes privacy practices as disclosed in the company's privacy policy.
              It is a neutral, factual restatement — not an evaluation.{" "}
              <Link href="/label" className="underline hover:text-gray-600">What is this?</Link>
            </p>
          </div>

          {/* ── Right: Privacy Score ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Privacy Score</div>

            {/* Grade display */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 flex items-center gap-5">
              <GradeBadge letter={grade.letter} size="lg" />
              <div>
                <div className="text-2xl font-black text-gray-900">
                  {grade.score}<span className="text-base font-normal text-gray-400">/100</span>
                </div>
                <div className="text-sm text-gray-600 mt-0.5">{grade.label}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Rubric v{grade.rubricVersion} · <Link href="/rubric" className="underline hover:text-gray-600">How is this calculated?</Link>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 leading-relaxed mb-6 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              The score reflects Privacy Panel's assessment based on our{" "}
              <Link href="/rubric" className="underline hover:text-amber-700">published rubric</Link>.
              It is our opinion. Not a legal determination. Grades measure disclosed practices,
              not actual behavior.
            </div>

            {/* Score breakdown */}
            <div className="mb-8">
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

            {/* Source evidence */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Source Evidence</h2>
                <a
                  href={`mailto:hello@privacypanel.org?subject=${encodeURIComponent(`Issue with ${displayName} analysis`)}`}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  Report an issue
                </a>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4 text-xs text-gray-600 leading-relaxed">
                Disputes are about findings, not grades. The grade is our opinion based on a{" "}
                <Link href="/rubric" className="underline hover:text-gray-800">published rubric</Link>.
                If a specific extraction below looks wrong (the quote does not match the policy, or the
                YES/no is misinterpreted), use the per-finding flag to help us improve.
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">What's on the label</div>
                <div className="space-y-3">
                  {[
                    { label: "Sold to third parties", field: facts.dataSharing.soldToThirdParties },
                    { label: "Shared for advertising", field: facts.dataSharing.sharedForAdvertising },
                    { label: "Cross-site tracking", field: facts.dataSharing.crossSiteTracking },
                    { label: "Used for profiling", field: facts.dataSharing.usedForProfiling },
                    { label: "Used to train AI", field: facts.dataSharing.usedToTrainAI },
                  ].map(({ label, field }) => (
                    <EvidenceCard key={label} label={label} field={field} companyName={displayName} />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signals & rights</div>
                <div className="space-y-3">
                  {[
                    { label: "Honors GPC", field: facts.signalHonoring.gpcDetail },
                    { label: "Honors DNT", field: facts.signalHonoring.dntDetail },
                  ].map(({ label, field }) => (
                    <EvidenceCard key={label} label={label} field={field} companyName={displayName} />
                  ))}
                </div>
              </div>
            </div>

            {/* Analysis metadata */}
            <div className="pt-6 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              <p>Analyzed {new Date(extraction.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <p>Rubric version {grade.rubricVersion} · <Link href="/rubric" className="underline hover:text-gray-600">View full rubric</Link></p>
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
