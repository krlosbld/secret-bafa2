import { NextResponse, type NextRequest } from "next/server";
import { AUTH_TTL } from "@/lib/auth";
import { PLAYER_AUTH_TTL } from "@/lib/playerAuth";
import { DIRECTOR_ACCOUNT_TTL } from "@/lib/directorAuth";

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const authRole = req.cookies.get("auth_role")?.value;
  const authUntil = Number(req.cookies.get("auth_until")?.value ?? "0");
  // Ne pas prolonger une session posée sous une ancienne durée de vie plus longue (force la reconnexion).
  if (authRole && Number.isFinite(authUntil) && Date.now() < authUntil && authUntil - Date.now() <= AUTH_TTL * 1000 + 5000) {
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: AUTH_TTL };
    res.cookies.set("auth_role", authRole, opts);
    res.cookies.set("auth_until", String(Date.now() + AUTH_TTL * 1000), opts);
    const managerId = req.cookies.get("auth_manager_id")?.value;
    if (managerId) res.cookies.set("auth_manager_id", managerId, opts);
  }

  const playerId = req.cookies.get("player_id")?.value;
  const playerUntil = Number(req.cookies.get("player_until")?.value ?? "0");
  if (playerId && Number.isFinite(playerUntil) && Date.now() < playerUntil && playerUntil - Date.now() <= PLAYER_AUTH_TTL * 1000 + 5000) {
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: PLAYER_AUTH_TTL };
    res.cookies.set("player_id", playerId, opts);
    res.cookies.set("player_until", String(Date.now() + PLAYER_AUTH_TTL * 1000), opts);
  }

  const directorAccountId = req.cookies.get("director_account_id")?.value;
  const directorAccountUntil = Number(req.cookies.get("director_account_until")?.value ?? "0");
  if (
    directorAccountId &&
    Number.isFinite(directorAccountUntil) &&
    Date.now() < directorAccountUntil &&
    directorAccountUntil - Date.now() <= DIRECTOR_ACCOUNT_TTL * 1000 + 5000
  ) {
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: DIRECTOR_ACCOUNT_TTL };
    res.cookies.set("director_account_id", directorAccountId, opts);
    res.cookies.set("director_account_until", String(Date.now() + DIRECTOR_ACCOUNT_TTL * 1000), opts);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
