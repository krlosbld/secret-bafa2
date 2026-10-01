import { NextResponse } from "next/server";
import { destroyCurrentUserSession } from "@/lib/userSession";
import { clearSessionCookies } from "@/lib/auth";
import { clearLegacyLoginCookies } from "@/lib/playerAuth";
import { readJsonBody } from "@/lib/requestGuard";

export const runtime = "nodejs";

// Déconnexion complète : session BafaPilot supprimée en base (invalidation immédiate), session admin
// (.env) et anciens cookies de connexion par code effacés.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const res = NextResponse.json({ ok: true });
  await destroyCurrentUserSession(res);
  clearSessionCookies(res);
  clearLegacyLoginCookies(res);
  return res;
}
