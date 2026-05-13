import Link from "next/link";
import { Header } from "@/components/Header";
import { searchCompanies } from "@/db/companies";

export const revalidate = 300;

const LABEL_SECTIONS = [
  {
    id: "title",
    heading: "Privacy Panel",
    color: "bg-gray-900 text-white",
    description:
      "The label title — modeled on the FDA Nutrition Facts panel. It signals a standardized, consistent format for reading about how a company handles your personal data.",
  },
  {
    id: "data-collected",
    heading: "Data Collected",
    color: "bg-red-50 border-red-200",
    description:
      "Lists every category of personal data the company collects, derived directly from the privacy policy. Sensitive data types (precise location, biometrics, health, financial) are shown first and highlighted in red. Non-sensitive categories follow, smaller and gray.",
  },
  {
    id: "data-sharing",
    heading: "How Data Is Shared",
    color: "bg-orange-50 border-orange-200",
    description:
      "Discloses whether your data is sold to third parties, shared for advertising, or used for profiling and automated decisions. Each row shows YES or NO based on what the policy actually states.",
  },
  {
    id: "third-parties",
    heading: "Third-Party Recipients",
    color: "bg-yellow-50 border-yellow-200",
    description:
      "Shows how many distinct categories of third parties receive your data (e.g., ad networks, analytics, data brokers, law enforcement). More categories = broader data exposure.",
  },
  {
    id: "retention",
    heading: "Retention",
    color: "bg-blue-50 border-blue-200",
    description:
      "States how long the company keeps your data. Indefinite retention is the worst outcome. Short, specific retention periods with deletion on request are best.",
  },
  {
    id: "consumer-rights",
    heading: "Your Rights",
    color: "bg-green-50 border-green-200",
    description:
      "Checks which consumer rights the company acknowledges: access, deletion, portability, correction, and opt-out. Rights are only credited when explicitly stated in the policy.",
  },
  {
    id: "signals",
    heading: "Privacy Signals",
    color: "bg-purple-50 border-purple-200",
    description:
      "Indicates whether the company honors Global Privacy Control (GPC) and Do Not Track (DNT) browser signals. These are technical mechanisms users can enable to limit data collection.",
  },
  {
    id: "security",
    heading: "Security",
    color: "bg-indigo-50 border-indigo-200",
    description:
      "Shows basic security practices as disclosed in the policy: encryption in transit (HTTPS/TLS), encryption at rest, multi-factor authentication availability, and breach notification commitments.",
  },
];

export default async function LabelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const results = query.length >= 2 ? searchCompanies(query, 8) : [];

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-3">The Privacy Panel Label</h1>
          <p className="text-gray-600 leading-relaxed max-w-2xl">
            Privacy Panel generates a standardized disclosure label for any company's privacy policy —
            modeled on the FDA Nutrition Facts panel. The label is <strong>factual and neutral</strong>:
            it restates what the policy actually says, without scoring or judgment.
          </p>
        </div>

        {/* ── Company search ──────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Look Up a Company</h2>
          <form method="GET" action="/label" className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search companies..."
              autoComplete="off"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Search
            </button>
          </form>

          {query.length >= 2 && (
            <div className="mt-3">
              {results.length === 0 ? (
                <p className="text-sm text-gray-400 mt-2">No companies found for "{query}".</p>
              ) : (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden mt-2">
                  {results.map((company) => (
                    <li key={company.id}>
                      <Link
                        href={`/company/${company.slug}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-900">{company.name}</span>
                        {company.domain && (
                          <span className="text-xs text-gray-400">{company.domain}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                  {results.length === 8 && (
                    <li>
                      <Link
                        href={`/directory?q=${encodeURIComponent(query)}`}
                        className="flex items-center justify-center px-4 py-2.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                      >
                        View all results in Directory →
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {!query && (
            <p className="text-xs text-gray-400 mt-3">
              Or browse the full{" "}
              <Link href="/directory" className="underline hover:text-gray-600">
                company directory
              </Link>
              .
            </p>
          )}
        </div>

        {/* ── Why a label? ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <div className="text-lg font-black text-gray-900 mb-2">Standardized</div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every label uses the same format and structure. You don't need to read 20 pages of legalese —
              the relevant information is always in the same place.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <div className="text-lg font-black text-gray-900 mb-2">Factual</div>
            <p className="text-sm text-gray-600 leading-relaxed">
              The label is a restatement of public disclosures — not an opinion or grade.
              Every item links back to the exact quote from the privacy policy that supports it.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <div className="text-lg font-black text-gray-900 mb-2">Comparable</div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Because every label uses the same schema, you can compare any two companies
              side by side and immediately see where they differ.
            </p>
          </div>
        </div>

        {/* ── Annotated walkthrough ───────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-gray-900 mb-2">What's on the label</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed max-w-2xl">
            Each section of the Privacy Panel label corresponds to a specific category of privacy practice.
            Here's what each one means and why it matters.
          </p>

          <div className="space-y-5">
            {LABEL_SECTIONS.map((section, i) => (
              <div key={section.id} className={`border rounded-xl overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${section.color} flex items-center gap-3`}>
                  <span className="text-xs font-bold text-gray-400 bg-white/60 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-black text-sm">{section.heading}</span>
                </div>
                <div className="px-5 py-4 bg-white">
                  <p className="text-sm text-gray-600 leading-relaxed">{section.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Methodology note ────────────────────────────────────────────── */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 mb-8">
          <h3 className="font-bold text-gray-900 mb-3">How the label is generated</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Privacy policies are parsed by an AI model (Claude by Anthropic) that extracts structured
            data from the raw policy text. For each field, the model provides the specific quote from
            the policy that supports its determination, along with a confidence score.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            The label reflects what the policy <em>discloses</em> — not what the company actually does.
            A company may have excellent practices that aren't reflected in a vague policy, or vice versa.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            This label summarizes privacy practices as disclosed in the company's privacy policy.
            This is not legal advice.
          </p>
        </div>

        {/* ── Separation from scoring ──────────────────────────────────────── */}
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-6">
          <h3 className="font-bold text-amber-900 mb-2">Label vs. Score</h3>
          <p className="text-sm text-amber-800 leading-relaxed mb-3">
            The Privacy Panel label is separate from the Privacy Score. The label is a neutral factual
            disclosure — it doesn't judge whether practices are good or bad. The score applies a
            published rubric to produce a letter grade, and is clearly labeled as our opinion.
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            You can use the label to draw your own conclusions, independent of our scoring.
            The rubric and scoring methodology are{" "}
            <Link href="/rubric" className="underline hover:text-amber-900">
              fully transparent and published
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
