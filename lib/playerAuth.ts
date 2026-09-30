import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { signCookie, verifyCookie, secureCookieBase } from "@/lib/signedCookie";

export const PLAYER_AUTH_TTL = 60 * 10; // 10 minutes, glissant (comme la session admin)

const COOKIE = "bp_player";
type PlayerPayload = { p: string; u: number };

function parse(value: string | undefined): { playerId: string } | null {
  const data = verifyCookie<PlayerPayload>(COOKIE, value);
  if (!data || typeof data.p !== "string" || !data.p || !Number.isFinite(data.u) || Date.now() >= data.u) return null;
  return { playerId: data.p };
}

export async function getPlayerSession(): Promise<{ playerId: string } | null> {
  const store = await cookies();
  return parse(store.get(COOKIE)?.value);
}

export function setPlayerSessionCookies(res: NextResponse, playerId: string) {
  const payload: PlayerPayload = { p: playerId, u: Date.now() + PLAYER_AUTH_TTL * 1000 };
  res.cookies.set(COOKIE, signCookie(COOKIE, payload), { ...secureCookieBase, maxAge: PLAYER_AUTH_TTL });
}

export function clearPlayerSessionCookies(res: NextResponse) {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}

// Session glissante : prolongée à chaque requête tant qu'elle est encore valide (appelé par proxy.ts).
export function refreshPlayerSessionCookie(req: NextRequest, res: NextResponse) {
  const session = parse(req.cookies.get(COOKIE)?.value);
  if (session) setPlayerSessionCookies(res, session.playerId);
}
