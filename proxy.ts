import { NextResponse, type NextRequest } from "next/server";
import { AUTH_TTL } from "@/lib/auth";
import { PLAYER_AUTH_TTL } from "@/lib/playerAuth";

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const authRole = req.cookies.get("auth_role")?.value;
  const authUntil = Number(req.cookies.get("auth_until")?.value ?? "0");
  if (authRole && Number.isFinite(authUntil) && Date.now() < authUntil) {
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: AUTH_TTL };
    res.cookies.set("auth_role", authRole, opts);
    res.cookies.set("auth_until", String(Date.now() + AUTH_TTL * 1000), opts);
    const managerId = req.cookies.get("auth_manager_id")?.value;
    if (managerId) res.cookies.set("auth_manager_id", managerId, opts);
  }

  const playerId = req.cookies.get("player_id")?.value;
  const playerUntil = Number(req.cookies.get("player_until")?.value ?? "0");
  if (playerId && Number.isFinite(playerUntil) && Date.now() < playerUntil) {
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: PLAYER_AUTH_TTL };
    res.cookies.set("player_id", playerId, opts);
    res.cookies.set("player_until", String(Date.now() + PLAYER_AUTH_TTL * 1000), opts);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
