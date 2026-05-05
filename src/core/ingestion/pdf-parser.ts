/**
 * pdf-parser.ts — Extract plain text from a PDF URL or Buffer.
 *
 * Uses pdf-parse (pure JS, no native deps) to extract text from PDF files.
 * Install: npm install pdf-parse @types/pdf-parse
 */

export interface PdfParseResult {
  success: true;
  text: string;
  pages: number;
  info: Record<string, unknown>;
}

export interface PdfParseError {
  success: false;
  error: string;
}

/**
 * Extract text from a PDF buffer.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult | PdfParseError> {
  try {
    // Use lib path to avoid pdf-parse v1's test-file side-effect on import
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default;
    const result = await pdfParse(buffer);
    return {
      success: true,
      text: result.text,
      pages: result.numpages,
      info: (result.info as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fetch a PDF from a URL and extract its text.
 */
export async function fetchAndParsePdf(url: string): Promise<PdfParseResult | PdfParseError> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PrivacyPanel/1.0 (+https://privacypanel.org/bot)",
        Accept: "application/pdf",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status} fetching PDF: ${url}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      return { success: false, error: `URL does not appear to be a PDF (Content-Type: ${contentType})` };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return parsePdfBuffer(buffer);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Return true if a URL looks like a PDF link.
 */
export function looksLikePdf(url: string, contentType?: string): boolean {
  if (contentType?.includes("pdf")) return true;
  const path = new URL(url).pathname.toLowerCase();
  return path.endsWith(".pdf");
}
