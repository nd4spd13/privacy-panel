/**
 * In-memory sliding-window rate limiter.
 *
 * Improvements over the original:
 * - Periodic cleanup of expired windows to prevent unbounded memory growth
 * - Separate limits for different tiers (analyze is more expensive)
 * - Returns standard headers for all responses
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Tier limits
export const LIMITS = {
  default: 100,  // general API calls
  analyze: 10,   // POST /api/v1/analyze — expensive (calls Claude API)
} as const;

export type LimitTier = keyof typeof LIMITS;

// Clean up expired entries every 15 minutes to prevent memory growth
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, win] of store.entries()) {
    if (now >= win.resetAt) store.delete(ip);
  }
}

function windowKey(ip: string, tier: LimitTier): string {
  return tier === "default" ? ip : `${ip}:${tier}`;
}

export function checkRateLimit(
  ip: string,
  tier: LimitTier = "default"
): { allowed: boolean; remaining: number; resetAt: number } {
  maybeCleanup();

  const max = LIMITS[tier];
  const key = windowKey(ip, tier);
  const now = Date.now();
  let win = store.get(key);

  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, win);
  }

  win.count++;
  const allowed = win.count <= max;
  const remaining = Math.max(0, max - win.count);

  return { allowed, remaining, resetAt: win.resetAt };
}

export function getRateLimitHeaders(
  ip: string,
  tier: LimitTier = "default"
): Record<string, string> {
  const max = LIMITS[tier];
  const key = windowKey(ip, tier);
  const now = Date.now();
  const win = store.get(key);
  const remaining = win ? Math.max(0, max - win.count) : max;
  const resetAt = win ? win.resetAt : now + WINDOW_MS;
  return {
    "X-RateLimit-Limit": String(max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}

/** Convenience: build a 429 response body */
export function rateLimitExceededBody(tier: LimitTier = "default") {
  return {
    error: "Rate limit exceeded",
    limit: LIMITS[tier],
    retryAfter: `${WINDOW_MS / 1000 / 60} minutes`,
  };
}
