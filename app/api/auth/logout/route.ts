import { NextResponse } from "next/server";
import { destroyCurrentUserSession } from "@/lib/userSession";
import { clearSessionCookies } from "@/lib/auth";
import { clearPlayerSessionCookies } from "@/lib/playerAuth";
import { clearDirectorAccountCookie } from "@/lib/directorAuth";
import { readJsonBody } from "@/lib/requestGuard";

export const runtime = "nodejs";

// Déconnexion complète : session BafaPilot supprimée en base (invalidation immédiate), et toutes les
// autres connexions du navigateur effacées (admin, stagiaire/formateur, compte directeur). Le code de
// session du jeu (bp_formation) est conservé : ce n'est pas une connexion.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const res = NextResponse.json({ ok: true });
  await destroyCurrentUserSession(res);
  clearSessionCookies(res);
  clearPlayerSessionCookies(res);
  clearDirectorAccountCookie(res);
  return res;
}
