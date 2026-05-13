/** URL-safe company slug (matches DB slugify output). */
export const PUBLIC_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export function isValidPublicSlug(slug: string): boolean {
  return PUBLIC_SLUG_PATTERN.test(slug);
}
