import { createHash } from "crypto";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface FetchMetadata {
  url: string;
  finalUrl: string;
  contentHash: string;
  fetchedAt: string;
  method: "readability" | "raw";
}

export interface FetchSuccess {
  success: true;
  text: string;
  metadata: FetchMetadata;
}

export interface FetchFailure {
  success: false;
  error: string;
}

export type FetchResult = FetchSuccess | FetchFailure;

const USER_AGENT = "PrivacyPanel/1.0 (+https://privacypanel.org/bot)";

/**
 * Fetch a privacy policy page and return clean plain text.
 * Uses @mozilla/readability to strip navigation, headers, footers.
 */
export async function fetchPolicy(url: string): Promise<FetchResult> {
  let finalUrl = url;
  let html: string;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    finalUrl = response.url;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf")) {
      return { success: false, error: "PDF policies require the pdf-parser module (not yet implemented). Download the PDF and use `privacypanel analyze --file policy.pdf`." };
    }

    html = await response.text();
  } catch (err) {
    return { success: false, error: `Fetch failed: ${(err as Error).message}` };
  }

  // Parse with Readability for clean article text
  let text: string;
  let method: FetchMetadata["method"] = "readability";

  try {
    const dom = new JSDOM(html, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent && article.textContent.trim().length > 200) {
      text = article.textContent.trim();
    } else {
      // Readability found nothing useful — fall back to raw text extraction
      method = "raw";
      text = extractRawText(html);
    }
  } catch {
    method = "raw";
    text = extractRawText(html);
  }

  if (text.trim().length < 100) {
    return { success: false, error: "Extracted text is too short — the page may require JavaScript rendering or the URL may not point to a privacy policy." };
  }

  return {
    success: true,
    text,
    metadata: {
      url,
      finalUrl,
      contentHash: sha256(text),
      fetchedAt: new Date().toISOString(),
      method,
    },
  };
}

/** Fallback: strip HTML tags to get raw text. */
function extractRawText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
