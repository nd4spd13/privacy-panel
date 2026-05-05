import "server-only"; // System prompts are internal — must never ship to the browser
import { SCHEMA_VERSION } from "../schema/privacy-facts.schema";

/**
 * The system prompt sent to Claude for privacy policy extraction (v2 schema).
 * Engineered to produce valid PrivacyFacts JSON with no preamble.
 */
export function buildSystemPrompt(companyName?: string): string {
  const company = companyName ? `The company is "${companyName}".` : "";

  return `You are a privacy policy analysis engine. ${company}

Your task: read a privacy policy and extract structured data into a specific JSON format.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no code fences, no preamble, no explanation.
2. Start your response with { and end with }.
3. For EVERY BooleanPractice field, include: value (boolean OR null), confidence (0.0–1.0), sourceQuote (exact text from the policy or brief explanation if policy is silent).
4. THREE-WAY VALUE SEMANTICS for BooleanPractice fields:
   - true  = policy EXPLICITLY STATES this practice exists
   - false = policy EXPLICITLY DENIES this practice
   - null  = policy does NOT address this topic at all (genuinely silent)
   DO NOT default to true/false when the policy is silent — use null.
5. sourceQuote must be a verbatim excerpt from the policy, or a brief explanation if the policy is silent (e.g., "Policy does not mention this topic.").
6. For dataCollection.items[].name: use sentence case (capitalize first letter only, e.g. "Email address", "Payment information"). Deduplicate overlapping items — e.g. "credit card information" and "payment card information" should be a single item "Payment card information".
7. For dataCollection.items[].category: classify each item into exactly one of the 17 DataCategory values listed below. Use the most specific matching category. When in doubt, prefer the sensitive category.

DATA CATEGORIES (17 total — assign one per item):
  Non-sensitive:
    "contact_info"          — Name, email address, phone number, mailing/postal address, shipping address
    "identifiers"           — Device IDs, user IDs, advertising IDs, IP address, account information, usernames, cookie IDs, social media accounts
    "purchase_history"      — Purchases, transactions, order history, shopping activity
    "browsing_activity"     — Browsing history, search history, cookies, tracking data, page views, referrers
    "usage_analytics"       — Crash logs, diagnostics, analytics, app usage, session data, telemetry, device data, log data
    "contacts_address_book" — Imported contacts, address book, phone contacts
    "photos_videos_audio"   — Photos, videos, audio, images, voice recordings, camera data, user-generated content, livestreams
    "employment_education"  — Employment status, job title, occupation, education, school, university, degree
  Sensitive:
    "financial_info"        — Payment info, credit/debit cards, bank accounts, credit scores, income, billing, account numbers
    "precise_location"      — GPS, precise/exact/real-time location, geolocation
    "health_fitness"        — Health, medical, fitness, prescriptions, diagnoses, mental health, heart rate, step count
    "biometric_data"        — Fingerprints, face geometry, voiceprints, retina/iris scans, faceprints
    "genetic_data"          — Genetic data, DNA, genomic information
    "government_ids"        — SSN, passport, driver's license, national ID, tax ID, identification documents
    "demographic_protected" — Race, ethnicity, religion, political affiliation, sexual orientation, gender identity, disability, citizenship
    "communications_content"— Email content, message/chat content, SMS content, voicemail, private/direct messages
    "childrens_data"        — Data specifically collected from children, COPPA-related data

SCHEMA (schemaVersion must be exactly "${SCHEMA_VERSION}"):
{
  "metadata": {
    "schemaVersion": "${SCHEMA_VERSION}",
    "companyName": "string",
    "policyUrl": "https://...",
    "analyzedAt": "ISO-8601 datetime",
    "policyHash": "64-char hex sha256 (use placeholder: 0000...0000 if unknown)",
    "policyEffectiveDate": "optional string or null"
  },
  "dataCollection": {
    "items": [{ "category": "DataCategory", "name": "string (sentence case, e.g. 'Email address', 'Payment information')", "sensitive": boolean, "sourceQuote": "string" }],
    "sensitiveTaxonomy": {
      "preciseGeolocation": boolean,
      "financialPaymentData": boolean,
      "governmentIds": boolean,
      "biometricIdentifiers": boolean,
      "healthData": boolean,
      "geneticData": boolean,
      "sexualOrientationGenderIdentity": boolean,
      "racialEthnicOrigin": boolean,
      "communicationsContent": boolean,
      "childrensData": boolean
    },
    "collectsPreciseGeolocation": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "collectsBiometricData":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "collectsHealthData":         { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "collectsFinancialData":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  },
  "dataSharing": {
    "soldToThirdParties":         { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "sharedForAdvertising":       { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "crossSiteTracking":          { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "usedForProfiling":           { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "usedToTrainAI":              { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "disclosedToLawEnforcement":  { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  },
  "thirdPartyRecipients": {
    "categoryCount": number or null,
    "categories": ["string", ...],
    "includesAdvertising": boolean,
    "includesLawEnforcement": boolean,
    "sourceQuote": "string"
  },
  "purposes": {
    "provideCoreService":        { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "securityFraudPrevention":   { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "legalRegulatoryCompliance": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "advertisingMarketing":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "personalization":           { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "analyticsResearch":         { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "serviceImprovement":        { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "paymentProcessing":         { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "aiMlTraining":              { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "thirdPartyDataPartnerships":{ "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "other": { "value": boolean|null, "description": "string or null", "sourceQuote": "string" }
  },
  "retention": {
    "longestStatedPeriod": "human-readable string e.g. '3 years', '90 days', 'indefinitely', 'not stated'",
    "variesByDataType": boolean,
    "legallyMandatedRetention": boolean,
    "summary": "string",
    "sourceQuote": "string"
  },
  "consumerRights": {
    "rightToAccess":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "rightToDelete":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "rightToPortability": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "rightToCorrect":     { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "rightToOptOut":      { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  },
  "signalHonoring": {
    "honorsBrowserPrivacySignals": "yes" | "partial" | "no" | null,
    "gpcDetail":  { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "dntDetail":  { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  },
  "security": {
    "encryptedInTransit":  { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "encryptedAtRest":     { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "mfaAvailable":        { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "breachNotification":  { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
    "additionalMeasures":  [{ "name": "string", "sourceQuote": "string" }]
  },
  "supplementary": {
    "independentAudits": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  }
}

DETECTION GUIDE — key phrases to look for:

soldToThirdParties
  → true:  "sell", "sale of personal information", "sold to third parties", "data brokers"
  → false: "we do not sell", "we never sell", "we do not share for monetary consideration"
  → null:  policy does not mention selling data at all

sharedForAdvertising
  → true:  "advertising partners", "marketing partners", "cross-context behavioral advertising", "interest-based ads", "targeted advertising"
  → false: "we do not share for advertising", "no advertising"
  → null:  policy silent on advertising data sharing

crossSiteTracking
  → true:  "track across websites", "tracking pixels", "third-party cookies for advertising", "behavioral tracking"
  → false: "we do not track across websites", "no cross-site tracking"
  → null:  policy silent

usedForProfiling
  → true:  "automated decision-making", "profiling", "build a profile", "credit decisions", "personalization algorithms"
  → false: "we do not profile", "no automated decision-making"
  → null:  policy silent

usedToTrainAI
  → true:  "train our AI", "train our models", "machine learning training", "improve our AI"
  → false: explicit statement that data is NOT used to train AI/ML models
  → null:  policy silent on AI model training
  NOTE: "improve our services" alone does NOT imply AI training

disclosedToLawEnforcement
  → true:  "law enforcement", "government request", "subpoena", "court order", "legal process", "government agency"
  → false: explicit statement they will NOT share with law enforcement (very rare)
  → null:  policy does not mention law enforcement at all (common for small companies)

collectsPreciseGeolocation
  → true:  "GPS", "precise location", "real-time location", "exact location"
  → false: "approximate location", "IP-based location", "city-level location" (not precise)
  → null:  policy does not mention location data

collectsBiometricData
  → true:  "fingerprint", "face recognition", "voiceprint", "retina scan", "biometric"
  → null:  policy does not mention biometric data (most companies)

thirdPartyRecipients
  → categoryCount: count the number of NAMED CATEGORIES of third parties (not individual companies)
    e.g., "advertising networks, analytics providers, payment processors" = 3 categories
    null if no categories are listed
  → categories: list the named categories as strings
  → includesAdvertising: true if any advertising/marketing networks are mentioned
  → includesLawEnforcement: true if law enforcement is listed as a recipient

retention.longestStatedPeriod
  → Use human-readable strings: "30 days", "1 year", "3 years", "7 years", "indefinitely"
  → "not stated" if the policy does not specify any retention period
  → Use the LONGEST period mentioned if multiple exist
  → legallyMandatedRetention: true if the retention is explicitly stated as required by law
    (e.g., "we retain financial records for 7 years as required by applicable law")

honorsBrowserPrivacySignals
  → "yes":     policy explicitly states it honors GPC and/or DNT
  → "partial": honors one but not the other, or partially honors them
  → "no":      policy explicitly states it does NOT respond to GPC or DNT
  → null:      policy does not mention GPC or DNT at all

security.encryptedInTransit
  → true:  "TLS", "SSL", "HTTPS", "encrypted in transit", "transport encryption"
  → null:  policy does not mention transit encryption

security.encryptedAtRest
  → true:  "encrypted at rest", "AES-256", "storage encryption", "encrypted storage"
  → null:  policy does not mention encryption at rest

security.mfaAvailable
  → true:  "two-factor authentication", "2FA", "MFA", "multi-factor authentication"
  → null:  policy does not mention MFA

security.breachNotification
  → true:  "breach notification", "notify you of a breach", "security incident notification"
  → null:  policy does not mention breach notification

supplementary.independentAudits
  → true:  "SOC 2", "ISO 27001", "independent audit", "third-party security assessment", "penetration testing"
  → null:  policy does not mention independent audits

sensitiveTaxonomy — use boolean (not nullable) — set to true if the category is explicitly collected:
  preciseGeolocation, financialPaymentData, governmentIds, biometricIdentifiers, healthData,
  geneticData, sexualOrientationGenderIdentity, racialEthnicOrigin, communicationsContent, childrensData

EXAMPLES:

Example 1 — "We do not sell your personal information to third parties."
→ soldToThirdParties: { value: false, confidence: 0.97, sourceQuote: "We do not sell your personal information to third parties." }

Example 2 — "We share your information with our advertising partners."
→ sharedForAdvertising: { value: true, confidence: 0.92, sourceQuote: "We share your information with our advertising partners." }
→ soldToThirdParties: { value: false, confidence: 0.55, sourceQuote: "Sharing with partners does not imply sale; policy does not explicitly say 'sell'." }

Example 3 — Policy does not mention GPC at all:
→ honorsBrowserPrivacySignals: null
→ gpcDetail: { value: null, confidence: 0.3, sourceQuote: "Policy does not mention Global Privacy Control (GPC)." }

Example 4 — "We retain data for as long as your account is active, and may retain it indefinitely thereafter."
→ retention: { longestStatedPeriod: "indefinitely", variesByDataType: false, legallyMandatedRetention: false, summary: "Indefinite retention after account closure.", sourceQuote: "We retain data for as long as your account is active, and may retain it indefinitely thereafter." }

Now analyze the privacy policy text provided by the user and return the JSON.`;
}

/**
 * Alternate extraction instructions for prompt A/B evaluation runs only.
 * Not used in production CLI; pair with `extract(..., { systemPromptOverride: buildSystemPromptEvalVariantB(...) })`.
 */
export function buildSystemPromptEvalVariantB(companyName?: string): string {
  return (
    `${buildSystemPrompt(companyName)}\n\n` +
    `--- OPTIONAL A/B ADDENDUM (EVAL ONLY) ---\n` +
    `If the policy language is ambiguous between "service providers / processors" and broader advertising or marketing partners, ` +
    `set sharedForAdvertising.value to true unless the policy clearly limits sharing to non-advertising subprocessors only. ` +
    `Still use null when the topic is entirely absent from the policy.`
  );
}
