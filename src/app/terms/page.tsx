import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Terms of Use | Privacy Panel",
  description: "Terms of use for privacypanel.org.",
};

const LAST_UPDATED = "May 28, 2026";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-black text-gray-900 mb-3">Terms of Use</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Acceptance</h2>
            <p>
              By accessing privacypanel.org (the &ldquo;Site&rdquo;), you agree to these Terms of Use. If you
              don&rsquo;t agree, don&rsquo;t use the Site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. What Privacy Panel is</h2>
            <p>
              The Site presents standardized, factual summaries (&ldquo;Privacy Panel labels&rdquo;) of companies&rsquo;
              publicly published privacy policies. Labels restate what a policy discloses. They are{" "}
              <strong>informational only</strong>, are <strong>not legal advice</strong>, and are not a
              substitute for reading a company&rsquo;s actual policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Accuracy and &ldquo;as of&rdquo; dates</h2>
            <p>
              Policies change. Each label reflects a specific version of a policy as of a stated analysis date
              and may not reflect current practices or text. Extraction uses automated tools and may contain
              errors. No warranty is made that labels are complete, current, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Not affiliated; trademarks</h2>
            <p>
              Privacy Panel is independent and is not affiliated with, endorsed by, or sponsored by any company
              featured. Company names, logos, and trademarks belong to their respective owners and are used for
              identification and commentary (nominative fair use) only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Corrections</h2>
            <p>
              If you believe a label misstates a policy, use the &ldquo;Dispute this finding&rdquo; link on the
              relevant company page, or contact us at the address below. Corrections are logged publicly in the{" "}
              <Link href="/changelog" className="underline hover:text-gray-900">changelog</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Intellectual property</h2>
            <p className="mb-3">
              Quotations from company policies are limited excerpts used for identification, commentary, and
              criticism. The Site&rsquo;s own content is &copy; its operator.
            </p>
            <p className="mb-3">
              The methodology, schema, and source code are published under the{" "}
              <a
                href="https://github.com/nd4spd13/privacy-panel/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-900"
              >
                MIT License
              </a>
              .
            </p>
            <p>
              You may link to and quote the Site with attribution. You may not republish it wholesale or present
              labels in a way that misrepresents their meaning.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Acceptable use</h2>
            <p>
              No automated bulk scraping beyond what <Link href="/robots.txt" className="underline hover:text-gray-900">robots.txt</Link> permits;
              no disruption of the Site; no unlawful use. The API is for reasonable, rate-limited use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Third-party links</h2>
            <p>
              The Site links to company sites and third-party archives (e.g., the Wayback Machine). We are not
              responsible for third-party content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. No warranty</h2>
            <p>
              The Site is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, to the
              fullest extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, the operator is not liable for indirect, incidental, or
              consequential damages. Total liability for any claim is limited to USD $100.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">11. Changes</h2>
            <p>
              We may update these Terms; the &ldquo;last updated&rdquo; date will change. Continued use of the Site after
              a change means acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">12. Governing law and venue</h2>
            <p className="mb-3">
              These Terms are governed by the laws of the State of New York and the United States, without
              regard to conflict-of-laws rules. Venue: state and federal courts located in New York.
            </p>
            <p className="mb-3">
              The parties rely on New York&rsquo;s anti-SLAPP statute (CPLR §§ 70-a, 76-a) for claims arising from
              the Site&rsquo;s protected speech. <strong>No binding arbitration.</strong>
            </p>
            <p>
              EU and UK visitors retain rights under their local law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">13. Operator and contact</h2>
            <p>
              Operated by the natural person who runs privacypanel.org; identity available on written request.
              General and legal/takedown contact:{" "}
              <a href="mailto:hello@privacypanel.org" className="underline hover:text-gray-900">
                hello@privacypanel.org
              </a>
              .
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-700">← Back to home</Link>
        </div>
      </main>
    </>
  );
}
