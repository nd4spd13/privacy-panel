import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LabelScaler } from "@/components/LabelScaler";
import { PrivacyPanelLabel } from "@/core/rendering/PrivacyPanelLabel";
import type { PrivacyPanel } from "@/core/schema/types";

export const metadata: Metadata = {
  title: "Privacy Policy — Privacy Panel",
  description:
    "How Privacy Panel collects and uses data — with a Privacy Label for our own site so you can see exactly what we do.",
};

const EFFECTIVE_DATE = "May 12, 2026";
const LAST_UPDATED = "May 12, 2026";

// Handcrafted disclosure for privacypanel.org — not AI-extracted.
// Update this object if our data practices change, then bump LAST_UPDATED above.
// policyHash is intentionally zeroed: this policy is not derived from a fetched document.
const SELF_DATA: PrivacyPanel = {
  metadata: {
    schemaVersion: "2.0.0",
    companyName: "Privacy Panel",
    policyUrl: "https://privacypanel.org/privacy",
    analyzedAt: "2026-05-12T00:00:00.000Z",
    policyHash: "0000000000000000000000000000000000000000000000000000000000000000",
    policyEffectiveDate: "2026-05-12",
  },
  dataCollection: {
    items: [
      {
        category: "usage_analytics",
        name: "App Usage & Diagnostics",
        sensitive: false,
        sourceQuote:
          "Self-managed Plausible CE captures page views, referrers, and a 'View Company' event. Aggregate only — no per-user records.",
      },
      {
        category: "identifiers",
        name: "Server access logs (IP, user agent)",
        sensitive: false,
        sourceQuote:
          "Railway, our hosting provider, captures HTTP access logs that include IP addresses, user agents, and request paths. We do not query these for analytics. Retention is governed by Railway.",
      },
    ],
    sensitiveTaxonomy: {
      preciseGeolocation: false,
      financialPaymentData: false,
      governmentIds: false,
      biometricIdentifiers: false,
      healthData: false,
      geneticData: false,
      sexualOrientationGenderIdentity: false,
      racialEthnicOrigin: false,
      communicationsContent: false,
      childrensData: false,
    },
    collectsPreciseGeolocation: { value: false, confidence: 1, sourceQuote: "Plausible does not collect precise location." },
    collectsBiometricData: { value: false, confidence: 1, sourceQuote: "No biometric data collected." },
    collectsHealthData: { value: false, confidence: 1, sourceQuote: "No health data collected." },
    collectsFinancialData: { value: false, confidence: 1, sourceQuote: "No financial data collected." },
  },
  dataSharing: {
    soldToThirdParties: { value: false, confidence: 1, sourceQuote: "We do not sell data to any party." },
    sharedForAdvertising: { value: false, confidence: 1, sourceQuote: "No advertising networks or marketing pixels are integrated." },
    crossSiteTracking: { value: false, confidence: 1, sourceQuote: "Plausible CE does not use cookies or cross-site identifiers." },
    usedForProfiling: { value: false, confidence: 1, sourceQuote: "No profiling or automated decision-making." },
    usedToTrainAI: { value: false, confidence: 1, sourceQuote: "Visitor data is not used to train any AI model." },
    disclosedToLawEnforcement: {
      value: false,
      confidence: 0.8,
      sourceQuote:
        "We hold no individual records to disclose. Infrastructure-level logs at Railway could be obtained via legal process directed at Railway.",
    },
  },
  thirdPartyRecipients: {
    categoryCount: 1,
    categories: ["Hosting & infrastructure (Railway)"],
    includesAdvertising: false,
    includesLawEnforcement: false,
    sourceQuote:
      "Privacy Panel is operated on Railway, a US-based PaaS that processes hosting and operational data on our behalf. No advertising, marketing, or data partners.",
  },
  purposes: {
    provideCoreService: { value: true, confidence: 1, sourceQuote: "The site delivers privacy policy analysis to visitors." },
    securityFraudPrevention: { value: true, confidence: 0.9, sourceQuote: "Rate limiting on public APIs uses transient IP records to prevent abuse." },
    legalRegulatoryCompliance: { value: false, confidence: 1, sourceQuote: "No regulated data held." },
    advertisingMarketing: { value: false, confidence: 1, sourceQuote: "No advertising or marketing." },
    personalization: { value: false, confidence: 1, sourceQuote: "No personalization." },
    analyticsResearch: { value: true, confidence: 1, sourceQuote: "Aggregate analytics via Plausible CE." },
    serviceImprovement: { value: true, confidence: 0.9, sourceQuote: "Analytics inform which features are used." },
    paymentProcessing: { value: false, confidence: 1, sourceQuote: "No payments processed." },
    aiMlTraining: { value: false, confidence: 1, sourceQuote: "Visitor data is not used to train AI." },
    thirdPartyDataPartnerships: { value: false, confidence: 1, sourceQuote: "No data partnerships." },
    other: { value: null, description: null, sourceQuote: "" },
  },
  retention: {
    longestStatedPeriod: "Indefinite (aggregate analytics)",
    variesByDataType: true,
    legallyMandatedRetention: false,
    summary:
      "Aggregate analytics: indefinite (no per-user records). Server access logs: per Railway's retention (typically days to weeks). Rate-limit IP entries: 1 hour, in memory only. Email correspondence: kept as long as needed to support you.",
    sourceQuote:
      "Plausible aggregates retained indefinitely with no per-user records. Server logs at Railway retained per Railway's retention policies.",
  },
  consumerRights: {
    rightToAccess: { value: true, confidence: 1, sourceQuote: "Email hello@privacypanel.org to request a data inquiry." },
    rightToDelete: { value: true, confidence: 1, sourceQuote: "Email hello@privacypanel.org to request deletion." },
    rightToPortability: { value: true, confidence: 0.9, sourceQuote: "We hold so little individual data that portability is trivially honored on request." },
    rightToCorrect: { value: true, confidence: 0.9, sourceQuote: "Email us — we will correct any data we hold about you." },
    rightToOptOut: { value: true, confidence: 1, sourceQuote: "Use a content blocker (e.g. uBlock Origin) to opt out of analytics entirely." },
  },
  signalHonoring: {
    honorsBrowserPrivacySignals: "yes",
    gpcDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Global Privacy Control by default." },
    dntDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Do Not Track by default." },
  },
  security: {
    encryptedInTransit: { value: true, confidence: 1, sourceQuote: "All traffic served over HTTPS/TLS." },
    encryptedAtRest: { value: true, confidence: 0.7, sourceQuote: "Railway encrypts persistent volumes at rest; our SQLite database resides on such a volume." },
    mfaAvailable: { value: false, confidence: 1, sourceQuote: "No user accounts exist on this site." },
    breachNotification: {
      value: true,
      confidence: 0.7,
      sourceQuote:
        "We will post a notice on this page within a reasonable period after discovering any breach materially affecting visitor data.",
    },
    additionalMeasures: [],
  },
  supplementary: {
    independentAudits: { value: false, confidence: 1, sourceQuote: "No independent audits conducted." },
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* ── Title ──────────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">
            Effective: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* ── Dogfooded label ─────────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-indigo-900 mb-1">We practice what we preach</p>
            <p className="text-sm text-indigo-800 leading-relaxed">
              Below is a Privacy Panel label for <strong>Privacy Panel itself</strong> — the same
              format we generate for every company on this site. Unlike our other labels, this one
              was handcrafted by us, not AI-extracted. It reflects our actual data practices,
              including disclosure of our hosting provider as a sub-processor.
            </p>
          </div>

          <div className="flex justify-center">
            <LabelScaler>
              <PrivacyPanelLabel data={SELF_DATA} />
            </LabelScaler>
          </div>
        </div>

        {/* ── Written policy ─────────────────────────────────────────────────── */}
        <div className="prose prose-gray max-w-none">

          {/* ── Who we are ───────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Who we are</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Privacy Panel is an independent, open-source project that publishes
              standardized privacy disclosures (&quot;labels&quot;) for consumer-facing companies.
              The site is operated by <strong>Christopher Brown</strong> as the data controller
              for purposes of GDPR and similar laws. We have no investors, no advertisers, and
              no commercial relationship with any company we analyze.
            </p>
            <p className="text-gray-600 leading-relaxed">
              You can reach us at{" "}
              <a href="mailto:hello@privacypanel.org" className="underline hover:text-gray-900">
                hello@privacypanel.org
              </a>
              . A postal address is available on request.
            </p>
          </section>

          {/* ── What we collect ──────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What we collect</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Privacy Panel deliberately collects very little. There are four sources of data
              tied to your visit:
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">1. Aggregate analytics (Plausible)</h3>
            <p className="text-gray-600 leading-relaxed mb-2">
              We run a self-managed instance of{" "}
              <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                Plausible CE
              </a>{" "}
              at <code className="text-sm bg-gray-100 px-1 rounded">analytics.privacypanel.org</code>.
              Plausible records:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mb-3 text-sm leading-relaxed">
              <li>Page views and the referring URL</li>
              <li>A &quot;View Company&quot; event recording which company you looked up</li>
              <li>Country-level location derived from your IP (the IP itself is not stored by Plausible)</li>
              <li>Browser and operating system family (aggregated, never per-user)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm">
              No cookies. No fingerprinting. No cross-site tracking.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">2. Server access logs (Railway)</h3>
            <p className="text-gray-600 leading-relaxed">
              Like every web service, the underlying web server records each request. Because
              Privacy Panel runs on Railway (see &quot;Where your data goes&quot; below), Railway
              captures access logs containing your IP address, user agent, request path, and
              response status. We do not query these logs for analytics. Their retention is
              governed by Railway&apos;s policies.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">3. Rate-limit records</h3>
            <p className="text-gray-600 leading-relaxed">
              Our public REST API uses an in-memory rate limiter that records caller IP
              addresses for up to one hour to enforce request quotas. These records are never
              persisted to disk and are discarded when the server restarts.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">4. Email you send us</h3>
            <p className="text-gray-600 leading-relaxed">
              If you email{" "}
              <a href="mailto:hello@privacypanel.org" className="underline hover:text-gray-900">
                hello@privacypanel.org
              </a>
              , we receive your email address, message, and any attachments. We keep correspondence
              for as long as needed to respond and to maintain a record of issues raised.
            </p>
          </section>

          {/* ── What we don't collect ────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What we don&apos;t collect</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm leading-relaxed">
              <li>No user accounts, no login, no passwords</li>
              <li>No contact forms or newsletter signups</li>
              <li>No advertising or marketing pixels</li>
              <li>No payment data</li>
              <li>No precise location, biometric, health, or financial data</li>
              <li>No device identifiers or browser fingerprinting</li>
              <li>No data sold to anyone, ever</li>
              <li>No data used to train AI models</li>
            </ul>
          </section>

          {/* ── Purposes & legal basis ───────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How we use your data</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We use the data above for three purposes only:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm leading-relaxed mb-4">
              <li><strong>To operate the site</strong> (serving pages, returning API responses)</li>
              <li><strong>To understand aggregate usage</strong> (which pages are popular, which companies visitors look up)</li>
              <li><strong>To prevent abuse</strong> (rate limiting on public APIs)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm">
              <strong>Legal basis (EU/UK visitors):</strong> We rely on{" "}
              <em>legitimate interests</em> (Art. 6(1)(f) GDPR) for aggregate analytics and
              abuse prevention. No special-category data is processed. You may object at any
              time using the rights described below.
            </p>
          </section>

          {/* ── Where data goes (sub-processors) ─────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Where your data goes</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Privacy Panel does not share data with advertisers, data brokers, or analytics
              partners. The only third parties involved are infrastructure providers
              (&quot;sub-processors&quot;) who process data on our behalf:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead className="bg-gray-50 text-left text-gray-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Sub-processor</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Policy</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2"><strong>Railway</strong></td>
                    <td className="px-3 py-2">Hosting (PaaS) for the website, API, database, and Plausible instance</td>
                    <td className="px-3 py-2">United States</td>
                    <td className="px-3 py-2">
                      <a href="https://railway.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                        railway.com/legal/privacy
                      </a>
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2"><strong>Email provider</strong></td>
                    <td className="px-3 py-2">Receives correspondence sent to <code className="text-xs bg-gray-100 px-1 rounded">hello@privacypanel.org</code></td>
                    <td className="px-3 py-2">United States</td>
                    <td className="px-3 py-2 text-gray-500">Available on request</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2"><strong>GitHub</strong></td>
                    <td className="px-3 py-2">Hosts the open-source repository. Receives any data you voluntarily include in issues, pull requests, or comments.</td>
                    <td className="px-3 py-2">United States</td>
                    <td className="px-3 py-2">
                      <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                        GitHub privacy
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-600 leading-relaxed text-sm">
              <strong>International transfers.</strong> Visitors from outside the United States
              have their data transferred to and processed in the United States by the providers
              above. Where required (e.g. for EU/UK visitors), we rely on the providers&apos;
              Standard Contractual Clauses or equivalent safeguards.
            </p>
          </section>

          {/* ── Retention ────────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How long we keep it</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm leading-relaxed">
              <li><strong>Aggregate analytics</strong> — indefinite (no individual records to retain)</li>
              <li><strong>Server access logs</strong> — per Railway&apos;s retention policy (typically days to weeks)</li>
              <li><strong>Rate-limit IP entries</strong> — up to 1 hour, in memory only, never persisted</li>
              <li><strong>Email correspondence</strong> — as long as needed to respond and maintain an issue record</li>
            </ul>
          </section>

          {/* ── Your rights ──────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your rights</h2>

            <h3 className="text-base font-semibold text-gray-800 mt-2 mb-2">Everyone</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm leading-relaxed mb-4">
              <li>
                <strong>Opt out of analytics</strong> — install a content blocker (e.g.{" "}
                <a href="https://ublockorigin.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                  uBlock Origin
                </a>
                ) and our Plausible script will not load
              </li>
              <li>
                <strong>Request access or deletion</strong> — email{" "}
                <a href="mailto:hello@privacypanel.org" className="underline hover:text-gray-900">
                  hello@privacypanel.org
                </a>{" "}
                with your request
              </li>
              <li>
                <strong>Browser signals</strong> — Plausible CE respects Global Privacy Control (GPC)
                and Do Not Track (DNT) by default
              </li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">EU / UK visitors (GDPR)</h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-2">
              You have the right to access, rectify, erase, restrict, port, or object to processing
              of your personal data (Articles 15–22). To exercise any of these, email us. You also
              have the right to lodge a complaint with your local supervisory authority (a list is
              available at{" "}
              <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                edpb.europa.eu
              </a>
              ).
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">California visitors (CCPA / CPRA)</h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-2">
              You have the right to know, delete, and correct personal information we hold about
              you, and the right to opt out of the &quot;sale&quot; or &quot;sharing&quot; of personal
              information. <strong>We do not sell or share personal information</strong> as those
              terms are defined under the CCPA, so there is nothing to opt out of. We do not use
              sensitive personal information for any purpose beyond providing the service.
              Submitting a request will not result in discriminatory treatment.
            </p>
          </section>

          {/* ── Children ─────────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Children</h2>
            <p className="text-gray-600 leading-relaxed">
              Privacy Panel is not directed to children under 13, and we do not knowingly
              collect personal information from anyone under 13. If you believe a child has
              provided us with personal information, contact us and we will delete it.
            </p>
          </section>

          {/* ── Security ─────────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Security</h2>
            <p className="text-gray-600 leading-relaxed mb-2">
              All traffic to Privacy Panel is served over HTTPS/TLS. There are no user accounts,
              so there is no authentication surface to attack. Persistent data sits on Railway
              volumes that are encrypted at rest. We deploy via signed pull requests and
              continuous integration.
            </p>
            <p className="text-gray-600 leading-relaxed text-sm">
              <strong>Breach notification.</strong> If we discover a security incident that
              materially affects visitor data, we will post a notice on this page and, where
              feasible, notify affected users by email within a reasonable period.
            </p>
          </section>

          {/* ── Changes ──────────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Changes to this policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this policy. The &quot;Last updated&quot; date at the top of the page
              will reflect the most recent change. Material changes will additionally be noted in
              a banner on the homepage for at least 30 days. The full revision history is visible
              in our{" "}
              <a href="https://github.com/crspy-inc/privacy-panel/commits/main/src/app/privacy/page.tsx" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                public commit log
              </a>
              .
            </p>
          </section>

          {/* ── Open source ──────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Open source</h2>
            <p className="text-gray-600 leading-relaxed">
              Privacy Panel is open source at{" "}
              <a
                href="https://github.com/crspy-inc/privacy-panel"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-900"
              >
                github.com/crspy-inc/privacy-panel
              </a>
              . You can inspect exactly how the site works and what data it accesses. If you
              believe this policy is inaccurate or incomplete, please open an issue or email us.
            </p>
          </section>

          {/* ── Governing law ────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Governing law</h2>
            <p className="text-gray-600 leading-relaxed">
              This policy is governed by the laws of the United States and the State of
              California, without regard to conflict-of-laws principles, except that EU/UK
              visitors retain all rights conferred by their local data-protection laws.
            </p>
          </section>

          {/* ── Contact ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              <a href="mailto:hello@privacypanel.org" className="underline hover:text-gray-900">
                hello@privacypanel.org
              </a>
            </p>
          </section>

        </div>

        {/* ── Footer nav ─────────────────────────────────────────────────────── */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-700">← Back to Privacy Panel</Link>
        </div>

      </main>
    </>
  );
}
