import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const PLAYER_AUTH_TTL = 60 * 60 * 24 * 7; // 7 jours

export async function getPlayerSession(): Promise<{ playerId: string } | null> {
  const store = await cookies();
  const playerId = store.get("player_id")?.value;
  const until = Number(store.get("player_until")?.value ?? "0");

  if (!playerId || !Number.isFinite(until) || Date.now() >= until) return null;

  return { playerId };
}

export function setPlayerSessionCookies(res: NextResponse, playerId: string) {
  const until = Date.now() + PLAYER_AUTH_TTL * 1000;
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: PLAYER_AUTH_TTL,
  };
  res.cookies.set("player_id", playerId, opts);
  res.cookies.set("player_until", String(until), opts);
}

export function clearPlayerSessionCookies(res: NextResponse) {
  const opts = { maxAge: 0, path: "/" };
  res.cookies.set("player_id", "", opts);
  res.cookies.set("player_until", "", opts);
}
