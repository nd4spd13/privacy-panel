/**
 * Convert a company name or arbitrary string to a URL-safe slug.
 * e.g. "Signal Messenger" → "signal-messenger"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // strip non-word chars except spaces and hyphens
    .replace(/[\s_]+/g, "-")    // spaces/underscores → hyphens
    .replace(/-{2,}/g, "-")     // collapse multiple hyphens
    .replace(/^-|-$/g, "");     // strip leading/trailing hyphens
}

/** Extract the apex domain from a URL. e.g. "https://signal.org/legal/" → "signal.org" */
export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
