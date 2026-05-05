import { getAnthropicClient, MODEL } from "../../lib/anthropic";
import { chunkPolicy, requiresChunking } from "./chunker";
import type { PrivacyPanel } from "../schema/types";
import { z } from "zod";

// ─── Gap-fill schema (only the v2-only fields) ──────────────────────────────

const BooleanPractice = z.object({
  value: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  sourceQuote: z.string(),
});

const GapFillSchema = z.object({
  purposes: z.object({
    provideCoreService: BooleanPractice,
    securityFraudPrevention: BooleanPractice,
    legalRegulatoryCompliance: BooleanPractice,
    advertisingMarketing: BooleanPractice,
    personalization: BooleanPractice,
    analyticsResearch: BooleanPractice,
    serviceImprovement: BooleanPractice,
    paymentProcessing: BooleanPractice,
    aiMlTraining: BooleanPractice,
    thirdPartyDataPartnerships: BooleanPractice,
    other: z.object({
      value: z.boolean().nullable(),
      description: z.string().nullable(),
      sourceQuote: z.string(),
    }),
  }),
  thirdPartyRecipients: z.object({
    categoryCount: z.number().int().min(0).nullable(),
    categories: z.array(z.string()),
    includesAdvertising: z.boolean(),
    includesLawEnforcement: z.boolean(),
    sourceQuote: z.string(),
  }),
  disclosedToLawEnforcement: BooleanPractice,
  sensitiveTaxonomy: z.object({
    preciseGeolocation: z.boolean(),
    financialPaymentData: z.boolean(),
    governmentIds: z.boolean(),
    biometricIdentifiers: z.boolean(),
    healthData: z.boolean(),
    geneticData: z.boolean(),
    sexualOrientationGenderIdentity: z.boolean(),
    racialEthnicOrigin: z.boolean(),
    communicationsContent: z.boolean(),
    childrensData: z.boolean(),
  }),
  supplementary: z.object({
    independentAudits: BooleanPractice,
  }),
});

type GapFillData = z.infer<typeof GapFillSchema>;

// ─── Gap-fill prompt ─────────────────────────────────────────────────────────

function buildGapFillPrompt(companyName: string): string {
  return `You are a privacy policy analysis engine. The company is "${companyName}".

We have already extracted most structured data from this privacy policy. We need you to extract ONLY the following additional fields that were not in our original extraction.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no code fences, no preamble.
2. Start your response with { and end with }.
3. For EVERY BooleanPractice field, include: value (boolean OR null), confidence (0.0–1.0), sourceQuote (exact text from the policy).
4. THREE-WAY VALUE SEMANTICS:
   - true  = policy EXPLICITLY STATES this practice exists
   - false = policy EXPLICITLY DENIES this practice
   - null  = policy does NOT address this topic at all
5. sourceQuote must be a verbatim excerpt from the policy, or a brief explanation if the policy is silent.

EXTRACT THIS JSON STRUCTURE:
{
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
  "thirdPartyRecipients": {
    "categoryCount": number or null,
    "categories": ["string", ...],
    "includesAdvertising": boolean,
    "includesLawEnforcement": boolean,
    "sourceQuote": "string"
  },
  "disclosedToLawEnforcement": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" },
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
  "supplementary": {
    "independentAudits": { "value": boolean|null, "confidence": 0.0–1.0, "sourceQuote": "string" }
  }
}

DETECTION GUIDE:

purposes — look for sections like "How we use your information", "Why we collect data":
  provideCoreService: using data to provide the main service (e.g. "to process your orders", "to enable our platform")
  securityFraudPrevention: "fraud prevention", "security purposes", "protect against abuse"
  legalRegulatoryCompliance: "comply with legal obligations", "regulatory requirements"
  advertisingMarketing: "send marketing emails", "show targeted ads", "promotional offers"
  personalization: "personalize your experience", "customize content", "recommendations"
  analyticsResearch: "analytics", "research", "understand how users interact"
  serviceImprovement: "improve our services", "enhance features", "product development"
  paymentProcessing: "process payments", "billing", "payment transactions"
  aiMlTraining: "train our AI", "machine learning", "train our models" (NOT just "improve services")
  thirdPartyDataPartnerships: "share with partners", "data partnerships", "provide data to third parties"
  other: any stated purpose not covered above

thirdPartyRecipients:
  categoryCount: count NAMED CATEGORIES of third parties (e.g. "advertising networks, analytics, payment processors" = 3)
  categories: list each named category as a string
  includesAdvertising: true if advertising/marketing networks are listed
  includesLawEnforcement: true if law enforcement/government is listed as a recipient

disclosedToLawEnforcement:
  → true: "law enforcement", "government request", "subpoena", "court order", "legal process"
  → false: explicit denial (very rare)
  → null: policy does not mention law enforcement

sensitiveTaxonomy — set true if the policy EXPLICITLY collects this category:
  preciseGeolocation, financialPaymentData, governmentIds, biometricIdentifiers, healthData,
  geneticData, sexualOrientationGenderIdentity, racialEthnicOrigin, communicationsContent, childrensData

supplementary.independentAudits:
  → true: "SOC 2", "ISO 27001", "independent audit", "third-party security assessment", "penetration testing"

Now analyze the privacy policy text and return the JSON.`;
}

// ─── Strip code fences ───────────────────────────────────────────────────────

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text;
}

// ─── Public types ────────────────────────────────────────────────────────────

export interface GapFillResult {
  success: true;
  data: GapFillData;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface GapFillFailure {
  success: false;
  error: string;
}

// ─── Single-chunk extraction ─────────────────────────────────────────────────

async function extractGapFillSingle(
  policyText: string,
  companyName: string,
  chunkNote = ""
): Promise<GapFillResult | GapFillFailure> {
  const startMs = Date.now();
  const systemPrompt = buildGapFillPrompt(companyName);
  const userMessage = chunkNote
    ? `${chunkNote}\n\n${policyText}`
    : policyText;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawOutput =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = stripCodeFences(rawOutput.trim());

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return { success: false, error: `JSON parse error: ${(err as Error).message}` };
    }

    const result = GapFillSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { success: false, error: `Validation failed: ${issues}` };
    }

    return {
      success: true,
      data: result.data,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startMs,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Merge multiple GapFillData results (worst-case for consumer) ────────────

function mergeGapFillResults(results: GapFillData[]): GapFillData {
  type BP = { value: boolean | null; confidence: number; sourceQuote: string };

  /** For harmful practices: true > null > false */
  function worstHarmful(values: BP[]): BP {
    return values.find((v) => v.value === true)
      ?? values.find((v) => v.value === null)
      ?? values[0];
  }

  /** For beneficial practices: false < null < true */
  function worstBeneficial(values: BP[]): BP {
    return values.find((v) => v.value === false)
      ?? values.find((v) => v.value === null)
      ?? values[0];
  }

  const base = results[0];

  function mergeBP(
    getter: (r: GapFillData) => BP,
    harmful: boolean
  ): BP {
    const values = results.map(getter);
    return harmful ? worstHarmful(values) : worstBeneficial(values);
  }

  // Merge third-party recipients: union categories, max count
  const allCategories = [...new Set(results.flatMap((r) => r.thirdPartyRecipients.categories))];
  const counts = results.map((r) => r.thirdPartyRecipients.categoryCount).filter((c): c is number => c !== null);

  // Merge sensitive taxonomy: OR (true in any chunk wins)
  const tax = base.sensitiveTaxonomy;
  const orTax = (f: keyof typeof tax) => results.some((r) => r.sensitiveTaxonomy[f]);

  return {
    purposes: {
      provideCoreService: mergeBP((r) => r.purposes.provideCoreService, false),
      securityFraudPrevention: mergeBP((r) => r.purposes.securityFraudPrevention, false),
      legalRegulatoryCompliance: mergeBP((r) => r.purposes.legalRegulatoryCompliance, false),
      advertisingMarketing: mergeBP((r) => r.purposes.advertisingMarketing, true),
      personalization: mergeBP((r) => r.purposes.personalization, true),
      analyticsResearch: mergeBP((r) => r.purposes.analyticsResearch, true),
      serviceImprovement: mergeBP((r) => r.purposes.serviceImprovement, false),
      paymentProcessing: mergeBP((r) => r.purposes.paymentProcessing, false),
      aiMlTraining: mergeBP((r) => r.purposes.aiMlTraining, true),
      thirdPartyDataPartnerships: mergeBP((r) => r.purposes.thirdPartyDataPartnerships, true),
      other: base.purposes.other,
    },
    thirdPartyRecipients: {
      categoryCount: counts.length > 0 ? Math.max(...counts) : null,
      categories: allCategories,
      includesAdvertising: results.some((r) => r.thirdPartyRecipients.includesAdvertising),
      includesLawEnforcement: results.some((r) => r.thirdPartyRecipients.includesLawEnforcement),
      sourceQuote: base.thirdPartyRecipients.sourceQuote,
    },
    disclosedToLawEnforcement: mergeBP((r) => r.disclosedToLawEnforcement, true),
    sensitiveTaxonomy: {
      preciseGeolocation: orTax("preciseGeolocation"),
      financialPaymentData: orTax("financialPaymentData"),
      governmentIds: orTax("governmentIds"),
      biometricIdentifiers: orTax("biometricIdentifiers"),
      healthData: orTax("healthData"),
      geneticData: orTax("geneticData"),
      sexualOrientationGenderIdentity: orTax("sexualOrientationGenderIdentity"),
      racialEthnicOrigin: orTax("racialEthnicOrigin"),
      communicationsContent: orTax("communicationsContent"),
      childrensData: orTax("childrensData"),
    },
    supplementary: {
      independentAudits: mergeBP((r) => r.supplementary.independentAudits, false),
    },
  };
}

// ─── Main gap-fill extraction (with chunking support) ────────────────────────

export async function extractGapFill(
  policyText: string,
  companyName: string
): Promise<GapFillResult | GapFillFailure> {
  if (!requiresChunking(policyText)) {
    return extractGapFillSingle(policyText, companyName);
  }

  // Chunked extraction
  const startMs = Date.now();
  const chunks = chunkPolicy(policyText);
  const chunkResults: GapFillData[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const chunk of chunks) {
    const chunkNote = `(Part ${chunk.index + 1} of ${chunks.length})`;
    const result = await extractGapFillSingle(chunk.text, companyName, chunkNote);

    if (!result.success) {
      return { success: false, error: `Chunk ${chunk.index + 1}/${chunks.length} failed: ${result.error}` };
    }

    chunkResults.push(result.data);
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
  }

  return {
    success: true,
    data: mergeGapFillResults(chunkResults),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    latencyMs: Date.now() - startMs,
  };
}

// ─── Merge gap-fill data into existing PrivacyPanel ──────────────────────────

export function mergeGapFill(existing: PrivacyPanel, gapFill: GapFillData): PrivacyPanel {
  return {
    ...existing,
    purposes: gapFill.purposes,
    thirdPartyRecipients: {
      ...existing.thirdPartyRecipients,
      ...gapFill.thirdPartyRecipients,
    },
    dataSharing: {
      ...existing.dataSharing,
      disclosedToLawEnforcement: gapFill.disclosedToLawEnforcement,
    },
    dataCollection: {
      ...existing.dataCollection,
      sensitiveTaxonomy: gapFill.sensitiveTaxonomy,
    },
    supplementary: gapFill.supplementary,
  };
}
