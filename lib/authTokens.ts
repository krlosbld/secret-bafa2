import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/userSession";

// Jetons envoyés par email : aléatoires (256 bits), à usage unique, temporaires. Seule l'empreinte
// est stockée ; le jeton en clair n'existe que dans le lien de l'email.

export type AuthTokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

export const AUTH_TOKEN_TTL: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000, // 24 h
  RESET_PASSWORD: 60 * 60 * 1000, // 1 h
};

// Crée un nouveau jeton et invalide les précédents du même type encore inutilisés : seul le
// dernier lien envoyé fonctionne (utile pour « renvoyer l'email »).
export async function createAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  const token = generateToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL[type]) },
    }),
  ]);
  return token;
}

export type ConsumeResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" | "used" };

// Consomme un jeton de façon atomique : deux clics simultanés sur le même lien ne peuvent pas
// réussir tous les deux (la mise à jour conditionnelle sur usedAt = null n'aboutit qu'une fois).
export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<ConsumeResult> {
  if (!token || token.length > 100) return { ok: false, reason: "invalid" };
  const tokenHash = hashToken(token);

  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true, type: true, usedAt: true, expiresAt: true } });
  if (!row || row.type !== type) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count !== 1) return { ok: false, reason: "used" };
  return { ok: true, userId: row.userId };
}

// Vérifie un jeton sans le consommer (ex. afficher le formulaire de nouveau mot de passe).
export async function peekAuthToken(token: string, type: AuthTokenType): Promise<ConsumeResult> {
  if (!token || token.length > 100) return { ok: false, reason: "invalid" };
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { userId: true, type: true, usedAt: true, expiresAt: true } });
  if (!row || row.type !== type) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.userId };
}
