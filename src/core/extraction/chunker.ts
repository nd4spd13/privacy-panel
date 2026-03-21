/** Maximum characters per chunk before splitting. */
export const MAX_CHUNK_CHARS = 150_000;

export interface Chunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}

/**
 * Split policy text into chunks when it exceeds MAX_CHUNK_CHARS.
 * Splits on paragraph boundaries where possible to avoid cutting mid-sentence.
 * Returns a single-element array for policies under the limit.
 */
export function chunkPolicy(text: string, maxChars = MAX_CHUNK_CHARS): Chunk[] {
  if (text.length <= maxChars) {
    return [{ index: 0, text, charStart: 0, charEnd: text.length }];
  }

  const chunks: Chunk[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < text.length) {
    const end = offset + maxChars;

    if (end >= text.length) {
      chunks.push({
        index: chunkIndex++,
        text: text.slice(offset),
        charStart: offset,
        charEnd: text.length,
      });
      break;
    }

    // Find the last paragraph break before the limit
    const slice = text.slice(offset, end);
    const lastBreak = slice.lastIndexOf("\n\n");
    const splitAt = lastBreak > 0 ? lastBreak + 2 : slice.lastIndexOf("\n") + 1 || maxChars;

    chunks.push({
      index: chunkIndex++,
      text: text.slice(offset, offset + splitAt),
      charStart: offset,
      charEnd: offset + splitAt,
    });

    offset += splitAt;
  }

  return chunks;
}

/** Returns true when the text requires chunking. */
export function requiresChunking(text: string, maxChars = MAX_CHUNK_CHARS): boolean {
  return text.length > maxChars;
}
