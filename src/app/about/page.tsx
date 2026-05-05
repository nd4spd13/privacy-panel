import Link from "next/link";
import { Header } from "@/components/Header";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* ── Title ───────────────────────────────────────────────────────── */}
        <h1 className="text-4xl font-black text-gray-900 mb-3">About Privacy Panel</h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-12">
          An open-source project that brings transparency to privacy policies —
          one company at a time.
        </p>

        {/* ── Mission ─────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Mission</h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            Privacy policies are long, deliberately opaque, and written by lawyers for lawyers.
            Most consumers never read them. Privacy Panel changes that by doing the reading for you
            and presenting the findings in a format anyone can understand — like an FDA Nutrition
            Facts label, but for your data.
          </p>
          <p className="text-gray-600 leading-relaxed">
            We believe consumers deserve to know, clearly and without jargon: Does this company sell
            my data? Does it track me across the web? Can I delete my data if I want to? Our tool
            answers these questions directly, with the exact language from the policy as evidence.
          </p>
        </section>

        {/* ── Methodology ─────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Methodology</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Every analysis follows the same three-step process:
          </p>
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Policy ingestion",
                body: "We fetch the company's public privacy policy URL using a responsible bot (PrivacyPanel/1.0) that respects robots.txt. The page is parsed with Mozilla's Readability library to strip navigation and extract the policy text.",
              },
              {
                step: "2",
                title: "AI extraction",
                body: "Claude (Anthropic's AI) reads the policy and extracts structured data: what data is collected, how it's shared, how long it's retained, what consumer rights are available, and whether privacy signals like GPC and DNT are honored. Each finding includes the source quote from the policy and a confidence score.",
              },
              {
                step: "3",
                title: "Deterministic grading",
                body: "A published, versioned rubric converts the structured data into a numeric score (0–100) and letter grade (A–F). The rubric is open-source — every point added or deducted is visible and explainable. The same extraction always produces the same score.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-black">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Conservative defaults ────────────────────────────────────────── */}
        <section className="mb-10 bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Conservative defaults</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            When a privacy policy is ambiguous or silent on a topic, we apply the
            consumer-unfavorable interpretation. A company that does not explicitly state it does{" "}
            <em>not</em> sell data will be treated as if it does. This is the conservative choice
            for consumer protection — it errs on the side of caution. The source evidence for each
            finding explains when this default was applied.
          </p>
        </section>

        {/* ── Legal disclaimers ────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Legal disclaimers</h2>
          <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>
              <strong>Not legal advice.</strong> Privacy Panel is an informational tool, not legal advice.
              Nothing on this site should be construed as legal advice about your rights under any privacy law.
            </p>
            <p>
              <strong>Opinions clearly labeled.</strong> The letter grade is our opinion based on our
              published rubric. It is clearly labeled as such on every analysis page. The factual
              extraction — what the policy says — is a restatement of the company's public disclosure.
            </p>
            <p>
              <strong>Accuracy.</strong> We make good-faith efforts to analyze privacy policies accurately
              using the latest AI models and a carefully designed extraction prompt. However, AI systems
              can make mistakes, and privacy policies can change. Analyses are dated; always check the
              current policy on the company's website for the most up-to-date information.
            </p>
            <p>
              <strong>Disputes.</strong> Companies that believe an analysis contains an error can submit
              a dispute with supporting evidence. We review all disputes and update analyses when warranted.
              See the <Link href="/rubric" className="underline hover:text-gray-900">rubric page</Link> for
              what we measure and why.
            </p>
            <p>
              <strong>No affiliation.</strong> Privacy Panel is an independent project. We are not affiliated
              with any company we analyze, any privacy advocacy organization, or any law firm.
            </p>
          </div>
        </section>

        {/* ── Open source ─────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Open source</h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            Privacy Panel is fully open source. The scoring rubric, extraction prompts, schema, and
            all application code are publicly available. We believe transparency in our methodology
            is essential to the project's credibility.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="https://github.com/privacypanel/privacy-panel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-gray-300 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              GitHub →
            </a>
            <Link
              href="/rubric"
              className="inline-flex items-center gap-1.5 border border-gray-300 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              View rubric →
            </Link>
            <a
              href="/rubric/v1.yaml"
              target="_blank"
              className="inline-flex items-center gap-1.5 border border-gray-300 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Download rubric YAML →
            </a>
            <a
              href="/schema/v1.json"
              target="_blank"
              className="inline-flex items-center gap-1.5 border border-gray-300 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Download schema JSON →
            </a>
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              To report an error in a company&apos;s label, use the{" "}
              <span className="font-medium text-gray-800">Dispute</span> link on
              any company page.
            </p>
            <p>
              To report a security vulnerability, open an issue on{" "}
              <a
                href="https://github.com/privacypanel/privacy-panel"
                className="underline hover:text-gray-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
