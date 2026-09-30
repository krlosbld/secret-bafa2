import { NextResponse, type NextRequest } from "next/server";
import { refreshSessionCookie } from "@/lib/auth";
import { refreshPlayerSessionCookie } from "@/lib/playerAuth";
import { refreshDirectorAccountCookie } from "@/lib/directorAuth";

// Sessions glissantes : chaque cookie signé encore valide est ré-émis avec une nouvelle échéance.
// Un cookie absent, expiré ou dont la signature ne correspond pas est simplement ignoré.
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  refreshSessionCookie(req, res);
  refreshPlayerSessionCookie(req, res);
  refreshDirectorAccountCookie(req, res);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
