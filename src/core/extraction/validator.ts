import { validate, SCHEMA_VERSION } from "../schema/privacy-facts.schema";
import type { PrivacyFacts } from "../schema/types";

export interface ValidationSuccess {
  success: true;
  data: PrivacyFacts;
}

export interface ValidationFailure {
  success: false;
  error: string;
  rawOutput: string;
}

export type ExtractionValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Parse and validate the raw string output from Claude.
 * Handles common LLM output artefacts (leading/trailing whitespace, code fences).
 */
export function validateExtractionOutput(
  rawOutput: string
): ExtractionValidationResult {
  const cleaned = stripCodeFences(rawOutput.trim());

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${(err as Error).message}`,
      rawOutput,
    };
  }

  const result = validate(parsed);
  if (!result.success) {
    const issues = result.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: `Schema validation failed: ${issues}`,
      rawOutput,
    };
  }

  // Ensure schemaVersion matches — belt-and-suspenders beyond the z.literal() check
  if (result.data.metadata.schemaVersion !== SCHEMA_VERSION) {
    return {
      success: false,
      error: `Unexpected schemaVersion: got ${result.data.metadata.schemaVersion}, expected ${SCHEMA_VERSION}`,
      rawOutput,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Strip markdown code fences that some LLMs emit even when instructed not to.
 * Handles ```json ... ```, ``` ... ```, and bare content.
 */
function stripCodeFences(text: string): string {
  // ```json\n...\n``` or ```\n...\n```
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text;
}
