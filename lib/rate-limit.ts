type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  ip: string,
  limit = 5,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Read-only: returns current state without incrementing the counter.
export function peekRateLimit(
  ip: string,
  limit = 5,
  windowMs = 60_000
): { available: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    return { available: true, remaining: limit, resetAt: now + windowMs };
  }

  const remaining = Math.max(0, limit - entry.count);
  return { available: remaining > 0, remaining, resetAt: entry.resetAt };
}
