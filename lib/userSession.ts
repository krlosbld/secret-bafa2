import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureCookieBase } from "@/lib/signedCookie";

// Sessions des comptes BafaPilot (User). Le cookie ne contient qu'un jeton aléatoire opaque de
// 256 bits : aucun rôle, aucun identifiant. Seule son empreinte SHA-256 est stockée en base
// (UserSession.tokenHash), et chaque requête revérifie la session et le compte côté serveur.
// Supprimer la ligne (déconnexion, changement de mot de passe) invalide la session immédiatement.

const COOKIE = "bp_session";
// Pendant une prise de contrôle, la session personnelle du super-admin est mise de côté ici pour
// pouvoir « revenir à mon compte » (même nature : jeton opaque, rien d'autre).
const ORIGIN_COOKIE = "bp_session_origin";
export const USER_SESSION_TTL = 60 * 60 * 24 * 30; // 30 jours
export const IMPERSONATION_TTL = 60 * 60; // 1 heure
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // lastUsedAt mis à jour au plus une fois par heure

export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: Date | null;
  platformRole: string;
  impersonatorId: string | null; // non null = session ouverte par un super-admin « en tant que »
  sessionExpiresAt: Date; // fin de la session (1 h pour une prise de contrôle)
};

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createUserSession(
  res: NextResponse,
  userId: string,
  userAgent?: string | null,
  options: { ttlSec?: number; impersonatorId?: string } = {}
) {
  const ttl = options.ttlSec ?? USER_SESSION_TTL;
  const token = generateToken();
  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttl * 1000),
      userAgent: userAgent?.slice(0, 300) ?? null,
      impersonatorId: options.impersonatorId ?? null,
    },
  });
  res.cookies.set(COOKIE, token, { ...secureCookieBase, maxAge: ttl });
}

async function sessionFromToken(token: string | undefined): Promise<CurrentUser | null> {
  if (!token || token.length > 100) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      impersonatorId: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, emailVerifiedAt: true, platformRole: true },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Une prise de contrôle expirée est gardée jusqu'au retour (stopImpersonation) : il faut savoir
    // vers quel compte renvoyer le super-admin et journaliser la fin. Les autres sont effacées.
    if (!session.impersonatorId) await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  return { ...session.user, impersonatorId: session.impersonatorId, sessionExpiresAt: session.expiresAt };
}

// Compte connecté (email confirmé ou non), ou null. Mis en cache pour la durée d'une requête :
// l'en-tête, la page et les contrôles d'accès ne relisent la session qu'une fois.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  return sessionFromToken(store.get(COOKIE)?.value);
});

// Compte connecté ET email confirmé — la seule condition pour accéder à l'espace BafaPilot.
export async function getVerifiedUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && user.emailVerifiedAt ? user : null;
}

// Compte personnel mis de côté pendant une prise de contrôle (le super-admin lui-même), s'il y en a un.
export async function getOriginUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  return sessionFromToken(store.get(ORIGIN_COOKIE)?.value);
}

export async function destroyCurrentUserSession(res: NextResponse) {
  const store = await cookies();
  for (const name of [COOKIE, ORIGIN_COOKIE]) {
    const token = store.get(name)?.value;
    if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
}

// Déconnecte toutes les sessions d'un compte (ex. après réinitialisation du mot de passe).
export async function destroyAllUserSessions(userId: string) {
  await prisma.userSession.deleteMany({ where: { userId } });
}

// « Se connecter en tant que » : ouvre une session d'une heure sur le compte visé, marquée avec
// l'identité du super-admin. Sa propre session (s'il est connecté avec son compte) est conservée
// dans ORIGIN_COOKIE, sans être modifiée.
export async function startImpersonation(res: NextResponse, targetUserId: string, impersonatorId: string) {
  const store = await cookies();
  const own = store.get(COOKIE)?.value;
  const alreadyImpersonating = !!store.get(ORIGIN_COOKIE)?.value;
  if (own && !alreadyImpersonating) {
    res.cookies.set(ORIGIN_COOKIE, own, { ...secureCookieBase, maxAge: USER_SESSION_TTL });
  } else if (own && alreadyImpersonating) {
    // Passage direct d'un compte à un autre : la session de prise de contrôle précédente est fermée.
    await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(own), impersonatorId: { not: null } } });
  }
  await createUserSession(res, targetUserId, null, { ttlSec: IMPERSONATION_TTL, impersonatorId });
}

// Fin de prise de contrôle : la session « en tant que » est supprimée et la session personnelle du
// super-admin est remise en place (le super-admin du .env retrouve simplement son cookie admin).
export async function stopImpersonation(
  res: NextResponse
): Promise<{ targetUserId: string | null; targetEmail: string | null; impersonatorId: string | null }> {
  const store = await cookies();
  const current = store.get(COOKIE)?.value;
  const row = current
    ? await prisma.userSession.findUnique({
        where: { tokenHash: hashToken(current) },
        select: { userId: true, impersonatorId: true, user: { select: { email: true } } },
      })
    : null;
  const origin = store.get(ORIGIN_COOKIE)?.value;
  const none = { targetUserId: null, targetEmail: null, impersonatorId: null };
  // Session normale en cours, ou rien à restaurer : on ne touche à rien.
  if ((row && !row.impersonatorId) || (!row && !origin)) return none;

  // row absent = la session « en tant que » a déjà disparu : on restaure quand même le compte d'origine.
  const targetUserId = row?.userId ?? null;
  if (row) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(current!) } });

  if (origin && (await sessionFromToken(origin))) {
    res.cookies.set(COOKIE, origin, { ...secureCookieBase, maxAge: USER_SESSION_TTL });
  } else {
    res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  }
  res.cookies.set(ORIGIN_COOKIE, "", { maxAge: 0, path: "/" });
  return { targetUserId, targetEmail: row?.user.email ?? null, impersonatorId: row?.impersonatorId ?? null };
}
