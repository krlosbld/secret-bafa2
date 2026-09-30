import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { signCookie, verifyCookie, secureCookieBase } from "@/lib/signedCookie";
import { getVerifiedUser } from "@/lib/userSession";

export type AuthRole = "superadmin" | "manager";

export interface AuthSession {
  role: AuthRole;
  managerId?: string;
}

export const AUTH_TTL = 60 * 10; // 10 minutes

const COOKIE = "bp_admin";
type AdminPayload = { r: AuthRole; m?: string; u: number };

function parse(value: string | undefined): AuthSession | null {
  const data = verifyCookie<AdminPayload>(COOKIE, value);
  if (!data || !Number.isFinite(data.u) || Date.now() >= data.u) return null;

  if (data.r === "superadmin") return { role: "superadmin" };
  if (data.r === "manager" && typeof data.m === "string" && data.m) return { role: "manager", managerId: data.m };
  return null;
}

export async function getSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const legacy = parse(store.get(COOKIE)?.value);
  if (legacy) return legacy;

  // Compte BafaPilot de niveau SUPERADMIN : mêmes droits que le super-admin historique. Le niveau
  // est relu en base à chaque requête via la session opaque — jamais déduit d'un cookie.
  const user = await getVerifiedUser();
  if (user?.platformRole === "SUPERADMIN") return { role: "superadmin" };
  return null;
}

export function isSuperAdmin(session: AuthSession | null): boolean {
  return session?.role === "superadmin";
}

export function setSessionCookies(res: NextResponse, session: AuthSession) {
  const payload: AdminPayload = { r: session.role, u: Date.now() + AUTH_TTL * 1000 };
  if (session.managerId) payload.m = session.managerId;
  res.cookies.set(COOKIE, signCookie(COOKIE, payload), { ...secureCookieBase, maxAge: AUTH_TTL });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}

// Session glissante : prolongée à chaque requête tant qu'elle est encore valide (appelé par proxy.ts).
export function refreshSessionCookie(req: NextRequest, res: NextResponse) {
  const session = parse(req.cookies.get(COOKIE)?.value);
  if (session) setSessionCookies(res, session);
}
