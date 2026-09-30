import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/teamAuth";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

// Suppression d'un compte BafaPilot. Supprimés avec lui : ses rattachements aux sessions, ses
// sessions de connexion et ses liens email. Conservés : les fiches Player et tout l'historique du
// BAFA Manager (évaluations, remarques, créneaux…), simplement détachés du compte.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, firstName: true, lastName: true, platformRole: true, _count: { select: { memberships: true } } },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  if (actor.userId === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte depuis l'administration." }, { status: 400 });
  }
  if (user.platformRole === "SUPERADMIN") {
    const others = await prisma.user.count({ where: { platformRole: "SUPERADMIN", id: { not: id } } });
    if (others === 0) return NextResponse.json({ error: "Impossible de supprimer le dernier compte super-admin." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  await audit(actor, "USER_DELETE", {
    targetUserId: id,
    targetLabel: user.email,
    details: `${user.firstName} ${user.lastName} — ${user._count.memberships} rattachement(s) retiré(s)`,
  });
  return NextResponse.json({ ok: true });
}
