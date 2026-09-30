// Limiteur de tentatives en mémoire (fenêtre fixe), suffisant pour une instance unique (pm2 fork).
// Sert à freiner le bourrinage sur la connexion, l'inscription et les envois d'emails.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count++;
  return { ok: bucket.count <= max, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}

// Adresse IP du client derrière nginx (X-Real-IP posé par le reverse proxy).
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
