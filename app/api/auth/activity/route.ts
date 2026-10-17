import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/requestGuard";
import { touchCurrentSession } from "@/lib/userSession";

export const runtime = "nodejs";

// Signal d'activité envoyé par la page (au plus toutes les 30 s) quand la personne utilise le site :
// repousse la déconnexion automatique après 15 minutes d'inactivité.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  return NextResponse.json({ ok: true, active: await touchCurrentSession() });
}
