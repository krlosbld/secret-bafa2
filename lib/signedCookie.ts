import crypto from "crypto";

// Cookies de session signés (HMAC-SHA256) : la valeur est `<payload base64url>.<signature base64url>`.
// Le "kind" est inclus dans la signature pour qu'un cookie signé d'un type (ex. joueur) ne puisse pas
// être recopié dans un cookie d'un autre type (ex. admin). Sans SESSION_SECRET, aucune session n'est
// acceptée et aucune ne peut être créée — on échoue fermé plutôt que de retomber sur un cookie en clair.

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function hmac(secret: string, kind: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(`${kind}.${payload}`).digest("base64url");
}

export function signCookie(kind: string, data: object): string {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${hmac(secret, kind, payload)}`;
}

export function verifyCookie<T>(kind: string, value: string | undefined): T | null {
  const secret = getSecret();
  if (!secret || !value) return null;

  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(hmac(secret, kind, payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data && typeof data === "object" ? (data as T) : null;
  } catch {
    return null;
  }
}

export const secureCookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
