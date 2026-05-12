import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LabelScaler } from "@/components/LabelScaler";
import { PrivacyPanelLabel } from "@/core/rendering/PrivacyPanelLabel";
import type { PrivacyPanel } from "@/core/schema/types";

export const metadata: Metadata = {
  title: "Privacy Policy — Privacy Panel",
  description: "How Privacy Panel collects and uses data — with a Privacy Label for our own site so you can see exactly what we do.",
};

// Handcrafted disclosure for privacypanel.org — not AI-extracted.
// Update this object if our data practices change.
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
        sourceQuote: "We use self-hosted Plausible CE for privacy-respecting analytics: page views, referrers, and a View Company event.",
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
    soldToThirdParties: { value: false, confidence: 1, sourceQuote: "We do not sell data to any third party." },
    sharedForAdvertising: { value: false, confidence: 1, sourceQuote: "No advertising networks used." },
    crossSiteTracking: { value: false, confidence: 1, sourceQuote: "Plausible does not use cross-site tracking or cookies." },
    usedForProfiling: { value: false, confidence: 1, sourceQuote: "No profiling or automated decision-making." },
    usedToTrainAI: { value: false, confidence: 1, sourceQuote: "Your data is not used to train AI models." },
    disclosedToLawEnforcement: { value: false, confidence: 0.8, sourceQuote: "We hold no individual user data to disclose." },
  },
  thirdPartyRecipients: {
    categoryCount: 0,
    categories: [],
    includesAdvertising: false,
    includesLawEnforcement: false,
    sourceQuote: "Plausible is self-hosted at analytics.privacypanel.org. Analytics data does not leave our infrastructure.",
  },
  purposes: {
    provideCoreService: { value: true, confidence: 1, sourceQuote: "The site delivers privacy policy analysis to visitors." },
    securityFraudPrevention: { value: false, confidence: 1, sourceQuote: "No user accounts; no fraud prevention needed." },
    legalRegulatoryCompliance: { value: false, confidence: 1, sourceQuote: "No regulated data held." },
    advertisingMarketing: { value: false, confidence: 1, sourceQuote: "No advertising or marketing." },
    personalization: { value: false, confidence: 1, sourceQuote: "No personalization." },
    analyticsResearch: { value: true, confidence: 1, sourceQuote: "Aggregate analytics via Plausible CE." },
    serviceImprovement: { value: true, confidence: 0.9, sourceQuote: "Analytics used to understand which features are used." },
    paymentProcessing: { value: false, confidence: 1, sourceQuote: "No payments processed." },
    aiMlTraining: { value: false, confidence: 1, sourceQuote: "Visitor data is not used to train AI." },
    thirdPartyDataPartnerships: { value: false, confidence: 1, sourceQuote: "No data partnerships." },
    other: { value: null, description: null, sourceQuote: "" },
  },
  retention: {
    longestStatedPeriod: "Indefinite",
    variesByDataType: false,
    legallyMandatedRetention: false,
    summary: "Aggregate analytics data is retained indefinitely. No individual user records are stored, so there is nothing tied to you personally.",
    sourceQuote: "Plausible CE retains aggregate analytics data with no per-user records.",
  },
  consumerRights: {
    rightToAccess: { value: true, confidence: 1, sourceQuote: "Email christopher.stevens.brown@gmail.com to request a data inquiry." },
    rightToDelete: { value: true, confidence: 1, sourceQuote: "Email us to request deletion of any data." },
    rightToPortability: { value: null, confidence: 0.5, sourceQuote: "" },
    rightToCorrect: { value: null, confidence: 0.5, sourceQuote: "" },
    rightToOptOut: { value: true, confidence: 1, sourceQuote: "Use a content blocker (e.g. uBlock Origin) to opt out of analytics entirely." },
  },
  signalHonoring: {
    honorsBrowserPrivacySignals: "yes",
    gpcDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Global Privacy Control by default." },
    dntDetail: { value: true, confidence: 0.9, sourceQuote: "Plausible CE respects Do Not Track by default." },
  },
  security: {
    encryptedInTransit: { value: true, confidence: 1, sourceQuote: "All traffic served over HTTPS/TLS." },
    encryptedAtRest: { value: null, confidence: 0.5, sourceQuote: "" },
    mfaAvailable: { value: false, confidence: 1, sourceQuote: "No user accounts exist on this site." },
    breachNotification: { value: null, confidence: 0.3, sourceQuote: "" },
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
          <p className="text-gray-500 text-sm">Last updated: May 2026</p>
        </div>

        {/* ── Dogfooded label ─────────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-indigo-900 mb-1">We practice what we preach</p>
            <p className="text-sm text-indigo-800 leading-relaxed">
              Below is a Privacy Panel label for <strong>Privacy Panel itself</strong> — the same
              format we generate for every company on this site. Unlike our other labels, this one
              was handcrafted by us, not AI-extracted. It reflects our actual data practices.
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

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What we collect</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We collect minimal data. The only data collection on this site is through a
              self-hosted instance of{" "}
              <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                Plausible CE
              </a>{" "}
              (Community Edition), running at <code className="text-sm bg-gray-100 px-1 rounded">analytics.privacypanel.org</code>.
            </p>
            <p className="text-gray-600 leading-relaxed mb-2">Plausible collects:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mb-3 text-sm leading-relaxed">
              <li>Page views and the referring URL</li>
              <li>A "View Company" event recording which company you looked up</li>
              <li>Country-level location derived from your IP address (the IP itself is not stored)</li>
              <li>Browser type and operating system (aggregated, never per-user)</li>
            </ul>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 leading-relaxed">
              <strong>No cookies. No fingerprinting. No cross-site tracking.</strong> Plausible is designed
              specifically to be privacy-respecting. All analytics data is stored on our own server and
              is never sent to third parties.
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What we don&apos;t collect</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm leading-relaxed">
              <li>No user accounts, no login, no passwords</li>
              <li>No contact forms or email collection</li>
              <li>No advertising or marketing pixels</li>
              <li>No payment data</li>
              <li>No precise location</li>
              <li>No device identifiers or fingerprinting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How we use your data</h2>
            <p className="text-gray-600 leading-relaxed">
              Solely to understand how the site is used — which companies are viewed, which pages
              are visited, where visitors come from. We use this to improve the site. We do not use
              your data for advertising, profiling, or any automated decision-making.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Third parties</h2>
            <p className="text-gray-600 leading-relaxed">
              None. Plausible is self-hosted — we run it ourselves on our own infrastructure. We do
              not use Google Analytics, Facebook Pixel, or any third-party analytics or advertising
              service. Your analytics data does not leave our servers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Data retention</h2>
            <p className="text-gray-600 leading-relaxed">
              Plausible analytics data is retained indefinitely in aggregate form. Because no individual
              user records are stored — only aggregate counts — there is nothing tied to you personally
              that could be deleted.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your rights</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm leading-relaxed">
              <li>
                <strong>Opt out</strong> — install a content blocker (e.g.{" "}
                <a href="https://ublockorigin.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">
                  uBlock Origin
                </a>
                ) and Plausible will not record your visit
              </li>
              <li>
                <strong>Access or deletion</strong> — email{" "}
                <a href="mailto:christopher.stevens.brown@gmail.com" className="underline hover:text-gray-900">
                  christopher.stevens.brown@gmail.com
                </a>{" "}
                to request a data inquiry or deletion
              </li>
              <li>
                <strong>Privacy signals</strong> — Plausible CE respects Global Privacy Control (GPC)
                and Do Not Track (DNT) by default
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Security</h2>
            <p className="text-gray-600 leading-relaxed">
              All traffic to Privacy Panel is served over HTTPS/TLS. There are no user accounts on
              this site, so there is no authentication surface to protect.
            </p>
          </section>

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
              . You can inspect exactly how the site works and what data it accesses. If you believe
              this policy is inaccurate, open an issue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              <a href="mailto:christopher.stevens.brown@gmail.com" className="underline hover:text-gray-900">
                christopher.stevens.brown@gmail.com
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
