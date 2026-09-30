import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/teamAuth";
import { readJsonBody } from "@/lib/requestGuard";
import { startImpersonation } from "@/lib/userSession";
import { audit, LEGACY_SUPERADMIN } from "@/lib/adminActor";

export const runtime = "nodejs";

// « Se connecter en tant que » : réservé au super-admin, jamais vers un autre super-admin, session
// d'une heure, marquée et journalisée. Le compte visé n'est pas modifié (ni mot de passe, ni sessions).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, platformRole: true, emailVerifiedAt: true } });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (target.platformRole === "SUPERADMIN") {
    return NextResponse.json({ error: "Impossible de se connecter en tant qu'un autre super-admin." }, { status: 403 });
  }
  if (!target.emailVerifiedAt) {
    return NextResponse.json({ error: "Ce compte n'a pas encore confirmé son adresse email : il n'a pas d'espace à consulter." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, next: "/sessions" });
  await startImpersonation(res, id, actor.userId ?? LEGACY_SUPERADMIN);
  await audit(actor, "IMPERSONATE_START", { targetUserId: id, targetLabel: target.email });
  return res;
}
