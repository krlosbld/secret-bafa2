import { NextResponse, type NextRequest } from "next/server";
import { refreshSessionCookie } from "@/lib/auth";

// Session glissante du super-admin historique (.env) : ré-émise avec une nouvelle échéance tant
// qu'elle est valide. Les comptes BafaPilot ont leur propre session en base (lib/userSession).
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  refreshSessionCookie(req, res);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
