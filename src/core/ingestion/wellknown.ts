/**
 * wellknown.ts — Check for a .well-known/privacy-panel.json at a domain.
 *
 * If a company hosts a pre-built Privacy Panel JSON at the well-known URL,
 * we can skip AI extraction entirely and use it directly.
 * This lets companies self-host their own verified label.
 */

import { validate } from "../schema/privacy-panel.schema";
import type { PrivacyPanel } from "../schema/types";

export interface WellKnownResult {
  success: true;
  data: PrivacyPanel;
  url: string;
}

export interface WellKnownMiss {
  success: false;
  reason: "not-found" | "invalid-json" | "schema-error" | "fetch-error";
  error?: string;
}

/**
 * Try to fetch .well-known/privacy-panel.json for the given domain/URL.
 * Returns the parsed PrivacyPanel if valid, otherwise a miss result.
 */
export async function checkWellKnown(policyUrl: string): Promise<WellKnownResult | WellKnownMiss> {
  const wellKnownUrl = buildWellKnownUrl(policyUrl);
  if (!wellKnownUrl) {
    return { success: false, reason: "fetch-error", error: "Could not parse domain from URL" };
  }

  try {
    const res = await fetch(wellKnownUrl, {
      headers: {
        "User-Agent": "PrivacyPanel/1.0 (+https://privacypanel.org/bot)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000), // 5s timeout — don't slow down the pipeline
    });

    if (res.status === 404) {
      return { success: false, reason: "not-found" };
    }

    if (!res.ok) {
      return { success: false, reason: "fetch-error", error: `HTTP ${res.status}` };
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      return { success: false, reason: "invalid-json", error: "Response is not valid JSON" };
    }

    const validation = validate(raw);
    if (!validation.success) {
      const issues = validation.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { success: false, reason: "schema-error", error: issues };
    }

    return { success: true, data: validation.data, url: wellKnownUrl };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("timed out") || msg.includes("abort")) {
      return { success: false, reason: "not-found" }; // Treat timeout as a miss
    }
    return { success: false, reason: "fetch-error", error: msg };
  }
}

/**
 * Build the .well-known URL from any URL in the same domain.
 * e.g. https://signal.org/legal/privacy/ → https://signal.org/.well-known/privacy-panel.json
 */
export function buildWellKnownUrl(anyUrl: string): string | null {
  try {
    const parsed = new URL(anyUrl);
    return `${parsed.protocol}//${parsed.host}/.well-known/privacy-panel.json`;
  } catch {
    return null;
  }
}
