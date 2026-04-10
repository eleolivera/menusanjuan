/**
 * In-memory rate limiter keyed by IP address.
 * Resets on cold starts — acceptable at current scale.
 * No external dependencies (no Redis).
 */

type RateLimitEntry = {
  count: number;
  resetAt: number; // epoch ms
};

const store = new Map<string, RateLimitEntry>();

type RateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Creates a rate limiter with the given config.
 * Returns a check function that takes an IP and returns the result.
 */
export function createRateLimiter(config: RateLimitConfig) {
  return function check(ip: string): RateLimitResult {
    const now = Date.now();

    // Auto-clean expired entries
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }

    const existing = store.get(ip);

    if (!existing || existing.resetAt <= now) {
      // First request or window expired
      const resetAt = now + config.windowMs;
      store.set(ip, { count: 1, resetAt });
      return { allowed: true, remaining: config.maxAttempts - 1, resetAt };
    }

    // Within window
    existing.count += 1;

    if (existing.count > config.maxAttempts) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - existing.count,
      resetAt: existing.resetAt,
    };
  };
}

/** Extract client IP from Vercel / reverse-proxy headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/** Shared limiter for auth endpoints: 10 attempts per IP per minute. */
export const authLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 60_000,
});
