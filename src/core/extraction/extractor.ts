import "server-only"; // Extraction calls Claude — must never run in the browser
import { createHash } from "crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL } from "../../lib/anthropic";
import { buildSystemPrompt } from "./prompts";
import { chunkPolicy, requiresChunking } from "./chunker";
import { validateExtractionOutput } from "./validator";
import type { PrivacyPanel } from "../schema/types";
import { SCHEMA_VERSION } from "../schema/privacy-panel.schema";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Optional overrides for tests and offline evaluation harnesses. */
export interface ExtractOptions {
  /** When set, API calls use this client instead of the shared SDK singleton. */
  anthropicClient?: Anthropic;
  /** Full system prompt replacement (e.g. A/B prompt experiments). */
  systemPromptOverride?: string;
}

export interface ExtractionMetadata {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  chunked: boolean;
  chunkCount: number;
  retried: boolean;
}

export interface ExtractionSuccess {
  success: true;
  data: PrivacyPanel;
  meta: ExtractionMetadata;
}

export interface ExtractionFailure {
  success: false;
  error: string;
  meta?: Partial<ExtractionMetadata>;
}

export type ExtractionResult = ExtractionSuccess | ExtractionFailure;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Extract a PrivacyPanel object from raw privacy policy text.
 *
 * @param policyText - The full plain-text content of the privacy policy
 * @param companyName - Optional company name hint for the prompt
 * @param policyUrl - The URL the policy was fetched from (written into metadata)
 */
export async function extract(
  policyText: string,
  companyName?: string,
  policyUrl = "https://unknown",
  options?: ExtractOptions
): Promise<ExtractionResult> {
  const startMs = Date.now();
  const policyHash = sha256(policyText);
  const chunks = chunkPolicy(policyText);
  const chunked = requiresChunking(policyText);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let retried = false;

  // For chunked policies, extract each chunk then merge
  if (chunked) {
    return extractChunked(chunks, companyName, policyUrl, policyHash, startMs, options);
  }

  // Single-chunk (the common path)
  const systemPrompt = options?.systemPromptOverride ?? buildSystemPrompt(companyName);
  const userMessage = buildUserMessage(policyText, companyName, policyUrl, policyHash);

  let lastError = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retried = true;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const client = options?.anthropicClient ?? getAnthropicClient();
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const rawOutput =
        response.content[0]?.type === "text" ? response.content[0].text : "";

      const validation = validateExtractionOutput(rawOutput);

      if (validation.success) {
        return {
          success: true,
          data: validation.data,
          meta: {
            model: MODEL,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            latencyMs: Date.now() - startMs,
            chunked: false,
            chunkCount: 1,
            retried,
          },
        };
      }

      // Validation failed — on the last attempt before giving up, try a repair prompt
      if (attempt === MAX_RETRIES - 2) {
        const repairResult = await attemptRepair(
          client,
          systemPrompt,
          userMessage,
          rawOutput,
          validation.error
        );
        if (repairResult.success) {
          totalInputTokens += repairResult.inputTokens;
          totalOutputTokens += repairResult.outputTokens;
          return {
            success: true,
            data: repairResult.data,
            meta: {
              model: MODEL,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              latencyMs: Date.now() - startMs,
              chunked: false,
              chunkCount: 1,
              retried: true,
            },
          };
        }
      }

      lastError = validation.error;
    } catch (err) {
      lastError = (err as Error).message;
      // Only retry on rate limit / server errors; surface auth errors immediately
      if (isNonRetryableError(err)) {
        return {
          success: false,
          error: lastError,
          meta: { model: MODEL, latencyMs: Date.now() - startMs },
        };
      }
    }
  }

  return {
    success: false,
    error: `Extraction failed after ${MAX_RETRIES} attempts: ${lastError}`,
    meta: {
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      latencyMs: Date.now() - startMs,
      retried,
    },
  };
}

// ─── Chunked extraction (rare — very long policies) ───────────────────────────

async function extractChunked(
  chunks: ReturnType<typeof chunkPolicy>,
  companyName: string | undefined,
  policyUrl: string,
  policyHash: string,
  startMs: number,
  options?: ExtractOptions
): Promise<ExtractionResult> {
  // Extract each chunk independently and merge: take the most conservative
  // (consumer-unfavorable) boolean value across chunks for each field.
  const results: PrivacyPanel[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const client = options?.anthropicClient ?? getAnthropicClient();
  const systemPrompt = options?.systemPromptOverride ?? buildSystemPrompt(companyName);

  for (const chunk of chunks) {
    const userMessage = buildUserMessage(
      chunk.text,
      companyName,
      policyUrl,
      policyHash,
      `(Part ${chunk.index + 1} of ${chunks.length})`
    );
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const rawOutput =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const validation = validateExtractionOutput(rawOutput);

    if (!validation.success) {
      return {
        success: false,
        error: `Chunk ${chunk.index} validation failed: ${validation.error}`,
        meta: { model: MODEL, chunked: true, chunkCount: chunks.length, latencyMs: Date.now() - startMs },
      };
    }

    results.push(validation.data);
  }

  const merged = mergeChunkResults(results, policyUrl, policyHash, companyName);
  return {
    success: true,
    data: merged,
    meta: {
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      latencyMs: Date.now() - startMs,
      chunked: true,
      chunkCount: chunks.length,
      retried: false,
    },
  };
}

/**
 * Merge multiple PrivacyPanel chunk results into one.
 * Uses the most consumer-unfavorable (worst-case) value for booleans.
 * Unions data items and security measures across chunks.
 */
function mergeChunkResults(
  results: PrivacyPanel[],
  policyUrl: string,
  policyHash: string,
  companyName?: string
): PrivacyPanel {
  const base = results[0];

  type BP = { value: boolean | null; confidence: number; sourceQuote: string };

  /**
   * Merge multiple nullable BooleanPractice values.
   * harmful=true: true > null > false (worst = most consumer-unfavorable)
   * harmful=false (rights/signals): false < null < true (worst = least consumer-favorable)
   */
  function worstBoolPractice(values: BP[], harmful: boolean): BP {
    if (harmful) {
      // true > null > false: find first true, else first null, else first false
      return values.find((v) => v.value === true)
        ?? values.find((v) => v.value === null)
        ?? values[0];
    } else {
      // false < null < true: find first false, else first null, else first true
      return values.find((v) => v.value === false)
        ?? values.find((v) => v.value === null)
        ?? values[0];
    }
  }

  function worstBool(
    key: "dataSharing" | "dataCollection" | "consumerRights" | "signalHonoring" | "security" | "supplementary",
    field: string,
    harmful = true
  ): BP {
    const values = results.map(
      (r) => (r[key] as Record<string, BP>)[field]
    );
    return worstBoolPractice(values, harmful);
  }

  // Merge retention: "worst" = indefinite > longest stated period > not stated
  function mergeRetention(): PrivacyPanel["retention"] {
    const indefiniteResult = results.find((r) =>
      ["indefinitely", "indefinite"].some((m) => r.retention.longestStatedPeriod.toLowerCase().includes(m))
    );
    if (indefiniteResult) return indefiniteResult.retention;

    // Pick longest stated period by parsing days
    return results.reduce((worst, r) => {
      const wDays = parseApproxDays(worst.longestStatedPeriod);
      const rDays = parseApproxDays(r.retention.longestStatedPeriod);
      return (rDays ?? 0) > (wDays ?? 0) ? r.retention : worst;
    }, base.retention);
  }

  // Merge honorsBrowserPrivacySignals: "no" > null > "partial" > "yes"
  function mergeSignalStatus(): "yes" | "partial" | "no" | null {
    const statuses = results.map((r) => r.signalHonoring.honorsBrowserPrivacySignals);
    if (statuses.includes("no")) return "no";
    if (statuses.includes(null)) return null;
    if (statuses.includes("partial")) return "partial";
    return "yes";
  }

  // Merge sensitiveTaxonomy: OR (true in any chunk wins)
  function mergeTaxonomy(): PrivacyPanel["dataCollection"]["sensitiveTaxonomy"] {
    const t = base.dataCollection.sensitiveTaxonomy;
    const orField = (f: keyof typeof t) => results.some((r) => r.dataCollection.sensitiveTaxonomy[f]);
    return {
      preciseGeolocation: orField("preciseGeolocation"),
      financialPaymentData: orField("financialPaymentData"),
      governmentIds: orField("governmentIds"),
      biometricIdentifiers: orField("biometricIdentifiers"),
      healthData: orField("healthData"),
      geneticData: orField("geneticData"),
      sexualOrientationGenderIdentity: orField("sexualOrientationGenderIdentity"),
      racialEthnicOrigin: orField("racialEthnicOrigin"),
      communicationsContent: orField("communicationsContent"),
      childrensData: orField("childrensData"),
    };
  }

  // Merge thirdPartyRecipients: max count, union categories
  function mergeThirdParties(): PrivacyPanel["thirdPartyRecipients"] {
    const counts = results.map((r) => r.thirdPartyRecipients.categoryCount).filter((c): c is number => c !== null);
    const allCategories = [...new Set(results.flatMap((r) => r.thirdPartyRecipients.categories))];
    return {
      categoryCount: counts.length > 0 ? Math.max(...counts) : null,
      categories: allCategories,
      includesAdvertising: results.some((r) => r.thirdPartyRecipients.includesAdvertising),
      includesLawEnforcement: results.some((r) => r.thirdPartyRecipients.includesLawEnforcement),
      sourceQuote: base.thirdPartyRecipients.sourceQuote,
    };
  }

  // Merge purposes: true in any chunk wins for harmful (advertising, aiML, thirdParty),
  // take base for others
  function mergePurposes(): PrivacyPanel["purposes"] {
    const bpMerge = (field: keyof Omit<PrivacyPanel["purposes"], "other">, harmful: boolean): BP => {
      const values = results.map((r) => r.purposes[field] as BP);
      return worstBoolPractice(values, harmful);
    };
    return {
      provideCoreService: bpMerge("provideCoreService", false),
      securityFraudPrevention: bpMerge("securityFraudPrevention", false),
      legalRegulatoryCompliance: bpMerge("legalRegulatoryCompliance", false),
      advertisingMarketing: bpMerge("advertisingMarketing", true),
      personalization: bpMerge("personalization", true),
      analyticsResearch: bpMerge("analyticsResearch", true),
      serviceImprovement: bpMerge("serviceImprovement", false),
      paymentProcessing: bpMerge("paymentProcessing", false),
      aiMlTraining: bpMerge("aiMlTraining", true),
      thirdPartyDataPartnerships: bpMerge("thirdPartyDataPartnerships", true),
      other: base.purposes.other,
    };
  }

  return {
    metadata: {
      ...base.metadata,
      schemaVersion: SCHEMA_VERSION,
      companyName: companyName ?? base.metadata.companyName,
      policyUrl,
      policyHash,
      analyzedAt: new Date().toISOString(),
    },
    dataCollection: {
      items: deduplicateItems(results.flatMap((r) => r.dataCollection.items)),
      sensitiveTaxonomy: mergeTaxonomy(),
      collectsPreciseGeolocation: worstBool("dataCollection", "collectsPreciseGeolocation"),
      collectsBiometricData: worstBool("dataCollection", "collectsBiometricData"),
      collectsHealthData: worstBool("dataCollection", "collectsHealthData"),
      collectsFinancialData: worstBool("dataCollection", "collectsFinancialData"),
    },
    dataSharing: {
      soldToThirdParties: worstBool("dataSharing", "soldToThirdParties"),
      sharedForAdvertising: worstBool("dataSharing", "sharedForAdvertising"),
      crossSiteTracking: worstBool("dataSharing", "crossSiteTracking"),
      usedForProfiling: worstBool("dataSharing", "usedForProfiling"),
      usedToTrainAI: worstBool("dataSharing", "usedToTrainAI"),
      disclosedToLawEnforcement: worstBool("dataSharing", "disclosedToLawEnforcement"),
    },
    thirdPartyRecipients: mergeThirdParties(),
    purposes: mergePurposes(),
    retention: mergeRetention(),
    consumerRights: {
      rightToAccess: worstBool("consumerRights", "rightToAccess", false),
      rightToDelete: worstBool("consumerRights", "rightToDelete", false),
      rightToPortability: worstBool("consumerRights", "rightToPortability", false),
      rightToCorrect: worstBool("consumerRights", "rightToCorrect", false),
      rightToOptOut: worstBool("consumerRights", "rightToOptOut", false),
    },
    signalHonoring: {
      honorsBrowserPrivacySignals: mergeSignalStatus(),
      gpcDetail: worstBool("signalHonoring", "gpcDetail", false),
      dntDetail: worstBool("signalHonoring", "dntDetail", false),
    },
    security: {
      encryptedInTransit: worstBool("security", "encryptedInTransit", false),
      encryptedAtRest: worstBool("security", "encryptedAtRest", false),
      mfaAvailable: worstBool("security", "mfaAvailable", false),
      breachNotification: worstBool("security", "breachNotification", false),
      additionalMeasures: deduplicateMeasures(results.flatMap((r) => r.security.additionalMeasures)),
    },
    supplementary: {
      independentAudits: worstBool("supplementary", "independentAudits", false),
    },
  };
}

function parseApproxDays(period: string): number | null {
  const p = period.toLowerCase().trim();
  const yearMatch = p.match(/(\d+(?:\.\d+)?)\s*year/);
  if (yearMatch) return parseFloat(yearMatch[1]) * 365;
  const monthMatch = p.match(/(\d+(?:\.\d+)?)\s*month/);
  if (monthMatch) return parseFloat(monthMatch[1]) * 30;
  const dayMatch = p.match(/(\d+(?:\.\d+)?)\s*day/);
  if (dayMatch) return parseFloat(dayMatch[1]);
  return null;
}

function deduplicateItems(items: PrivacyPanel["dataCollection"]["items"]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateMeasures(measures: PrivacyPanel["security"]["additionalMeasures"]) {
  const seen = new Set<string>();
  return measures.filter((m) => {
    const key = m.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Repair attempt ───────────────────────────────────────────────────────────

async function attemptRepair(
  client: ReturnType<typeof getAnthropicClient>,
  systemPrompt: string,
  originalUserMessage: string,
  badOutput: string,
  validationError: string
): Promise<
  | { success: true; data: PrivacyPanel; inputTokens: number; outputTokens: number }
  | { success: false }
> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: "user", content: originalUserMessage },
        { role: "assistant", content: badOutput },
        {
          role: "user",
          content: `Your previous response failed schema validation: ${validationError}\n\nPlease fix the JSON and return ONLY the corrected JSON object.`,
        },
      ],
    });

    const rawOutput =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const validation = validateExtractionOutput(rawOutput);

    if (validation.success) {
      return {
        success: true,
        data: validation.data,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    }
  } catch {
    // Ignore repair errors — fall through to outer retry loop
  }
  return { success: false };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUserMessage(
  policyText: string,
  companyName: string | undefined,
  policyUrl: string,
  policyHash: string,
  chunkNote = ""
): string {
  const header = [
    companyName ? `Company: ${companyName}` : null,
    `Policy URL: ${policyUrl}`,
    `Policy hash (SHA-256): ${policyHash}`,
    `Analyzed at: ${new Date().toISOString()}`,
    chunkNote || null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n\n---\n\n${policyText}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonRetryableError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return msg.includes("401") || msg.includes("403") || msg.includes("invalid_api_key");
}
