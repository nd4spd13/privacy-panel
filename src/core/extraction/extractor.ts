import "server-only"; // Extraction calls Claude — must never run in the browser
import { createHash } from "crypto";
import { getAnthropicClient, MODEL } from "../../lib/anthropic";
import { buildSystemPrompt } from "./prompts";
import { chunkPolicy, requiresChunking } from "./chunker";
import { validateExtractionOutput } from "./validator";
import type { PrivacyFacts } from "../schema/types";
import { SCHEMA_VERSION } from "../schema/privacy-facts.schema";

// ─── Public types ─────────────────────────────────────────────────────────────

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
  data: PrivacyFacts;
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
 * Extract a PrivacyFacts object from raw privacy policy text.
 *
 * @param policyText - The full plain-text content of the privacy policy
 * @param companyName - Optional company name hint for the prompt
 * @param policyUrl - The URL the policy was fetched from (written into metadata)
 */
export async function extract(
  policyText: string,
  companyName?: string,
  policyUrl = "https://unknown"
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
    return extractChunked(chunks, companyName, policyUrl, policyHash, startMs);
  }

  // Single-chunk (the common path)
  const systemPrompt = buildSystemPrompt(companyName);
  const userMessage = buildUserMessage(policyText, companyName, policyUrl, policyHash);

  let lastError = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retried = true;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const client = getAnthropicClient();
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
  startMs: number
): Promise<ExtractionResult> {
  // Extract each chunk independently and merge: take the most conservative
  // (consumer-unfavorable) boolean value across chunks for each field.
  const results: PrivacyFacts[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const chunk of chunks) {
    const systemPrompt = buildSystemPrompt(companyName);
    const userMessage = buildUserMessage(
      chunk.text,
      companyName,
      policyUrl,
      policyHash,
      `(Part ${chunk.index + 1} of ${chunks.length})`
    );

    const client = getAnthropicClient();
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
 * Merge multiple PrivacyFacts chunk results into one.
 * Uses the most consumer-unfavorable (worst-case) value for booleans.
 * Unions data items and security measures across chunks.
 */
function mergeChunkResults(
  results: PrivacyFacts[],
  policyUrl: string,
  policyHash: string,
  companyName?: string
): PrivacyFacts {
  const base = results[0];

  function worstBool(key: "dataSharing" | "dataCollection" | "consumerRights" | "signalHonoring", field: string) {
    // For harmful practices: true is worst. For rights: false is worst.
    const isRight = key === "consumerRights";
    const isSignal = key === "signalHonoring";
    const values = results.map((r) => (r[key] as Record<string, { value: boolean; confidence: number; sourceQuote: string }>)[field]);
    if (isRight || isSignal) {
      // Lower is worse (false = fewer rights / doesn't honor)
      return values.reduce((worst, v) =>
        !v.value ? v : worst
      );
    }
    // Higher (true) is worse for harmful practices
    return values.reduce((worst, v) => (v.value ? v : worst));
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
      thirdPartyCount: Math.max(...results.map((r) => r.dataSharing.thirdPartyCount ?? 0)),
    },
    retention: results.find((r) => r.retention.indefinite)?.retention ??
      results.reduce((worst, r) =>
        (r.retention.retentionDays ?? 0) > (worst.retention.retentionDays ?? 0) ? r : worst
      ).retention,
    consumerRights: {
      rightToAccess: worstBool("consumerRights", "rightToAccess"),
      rightToDelete: worstBool("consumerRights", "rightToDelete"),
      rightToPortability: worstBool("consumerRights", "rightToPortability"),
      rightToCorrect: worstBool("consumerRights", "rightToCorrect"),
      rightToOptOut: worstBool("consumerRights", "rightToOptOut"),
      rightToNonDiscrimination: worstBool("consumerRights", "rightToNonDiscrimination"),
    },
    signalHonoring: {
      honorsGPC: worstBool("signalHonoring", "honorsGPC"),
      honorsDNT: worstBool("signalHonoring", "honorsDNT"),
    },
    security: {
      measures: deduplicateMeasures(results.flatMap((r) => r.security.measures)),
    },
  };
}

function deduplicateItems(items: PrivacyFacts["dataCollection"]["items"]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateMeasures(measures: PrivacyFacts["security"]["measures"]) {
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
  | { success: true; data: PrivacyFacts; inputTokens: number; outputTokens: number }
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
