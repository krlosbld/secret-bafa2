import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { signCookie, verifyCookie, secureCookieBase } from "@/lib/signedCookie";

export const DIRECTOR_ACCOUNT_TTL = 60 * 10; // 10 minutes, glissant (comme les autres sessions)

const COOKIE = "bp_director";
type DirectorPayload = { d: string; u: number };

function parse(value: string | undefined): { directorAccountId: string } | null {
  const data = verifyCookie<DirectorPayload>(COOKIE, value);
  if (!data || typeof data.d !== "string" || !data.d || !Number.isFinite(data.u) || Date.now() >= data.u) return null;
  return { directorAccountId: data.d };
}

export async function getDirectorAccountSession(): Promise<{ directorAccountId: string } | null> {
  const store = await cookies();
  return parse(store.get(COOKIE)?.value);
}

export function setDirectorAccountCookie(res: NextResponse, directorAccountId: string) {
  const payload: DirectorPayload = { d: directorAccountId, u: Date.now() + DIRECTOR_ACCOUNT_TTL * 1000 };
  res.cookies.set(COOKIE, signCookie(COOKIE, payload), { ...secureCookieBase, maxAge: DIRECTOR_ACCOUNT_TTL });
}

export function clearDirectorAccountCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}

// Session glissante : prolongée à chaque requête tant qu'elle est encore valide (appelé par proxy.ts).
export function refreshDirectorAccountCookie(req: NextRequest, res: NextResponse) {
  const session = parse(req.cookies.get(COOKIE)?.value);
  if (session) setDirectorAccountCookie(res, session.directorAccountId);
}
