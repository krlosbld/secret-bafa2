import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureCookieBase } from "@/lib/signedCookie";

// Sessions des comptes BafaPilot (User). Le cookie ne contient qu'un jeton aléatoire opaque de
// 256 bits : aucun rôle, aucun identifiant. Seule son empreinte SHA-256 est stockée en base
// (UserSession.tokenHash), et chaque requête revérifie la session et le compte côté serveur.
// Supprimer la ligne (déconnexion, changement de mot de passe) invalide la session immédiatement.

const COOKIE = "bp_session";
export const USER_SESSION_TTL = 60 * 60 * 24 * 30; // 30 jours
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // lastUsedAt mis à jour au plus une fois par heure

export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: Date | null;
  platformRole: string;
};

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createUserSession(res: NextResponse, userId: string, userAgent?: string | null) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + USER_SESSION_TTL * 1000);
  await prisma.userSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 300) ?? null },
  });
  res.cookies.set(COOKIE, token, { ...secureCookieBase, maxAge: USER_SESSION_TTL });
}

// Compte connecté (email confirmé ou non), ou null. À combiner avec requireVerifiedUser() pour
// tout ce qui relève de l'espace normal de BafaPilot.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, emailVerifiedAt: true, platformRole: true },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  return session.user;
}

// Compte connecté ET email confirmé — la seule condition pour accéder à l'espace BafaPilot.
export async function getVerifiedUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && user.emailVerifiedAt ? user : null;
}

export async function destroyCurrentUserSession(res: NextResponse) {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}

// Déconnecte toutes les sessions d'un compte (ex. après réinitialisation du mot de passe).
export async function destroyAllUserSessions(userId: string) {
  await prisma.userSession.deleteMany({ where: { userId } });
}
