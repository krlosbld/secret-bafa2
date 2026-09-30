import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Garde commune des routes d'authentification :
// - JSON obligatoire : un formulaire d'un autre site ne peut pas l'envoyer sans pré-vérification CORS ;
// - si le navigateur indique une origine, elle doit être celle du site.
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | NextResponse> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  return body as Record<string, unknown>;
}

export function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// Applique plusieurs limites (ex. par IP et par email) ; renvoie une réponse 429 si l'une est dépassée.
export function limited(req: Request, rules: { key: string; max: number; windowMs: number }[]): NextResponse | null {
  const ip = clientIp(req);
  for (const rule of rules) {
    const r = rateLimit(rule.key.replace("{ip}", ip), rule.max, rule.windowMs);
    if (!r.ok) {
      const minutes = Math.max(1, Math.ceil(r.retryAfterSec / 60));
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` },
        { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } }
      );
    }
  }
  return null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Redirection après connexion : uniquement un chemin interne (jamais //autre-site.fr).
export function safeNextPath(next: unknown, fallback = "/sessions"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
