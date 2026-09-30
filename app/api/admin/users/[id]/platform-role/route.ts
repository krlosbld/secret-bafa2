import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/teamAuth";
import { readJsonBody, str } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

const PLATFORM_ROLES = ["AUCUN", "GESTIONNAIRE", "SUPERADMIN"];

// Niveau global du compte (indépendant des rôles par session).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const platformRole = str(body.platformRole, 30);
  if (!PLATFORM_ROLES.includes(platformRole)) return NextResponse.json({ error: "Niveau invalide." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id }, select: { email: true, platformRole: true } });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (user.platformRole === platformRole) return NextResponse.json({ ok: true });

  if (user.platformRole === "SUPERADMIN") {
    if (actor.userId === id) return NextResponse.json({ error: "Vous ne pouvez pas retirer votre propre niveau super-admin." }, { status: 400 });
    const others = await prisma.user.count({ where: { platformRole: "SUPERADMIN", id: { not: id } } });
    if (others === 0) return NextResponse.json({ error: "Il doit rester au moins un compte super-admin." }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: { platformRole } });
  // Un compte qui n'est plus gestionnaire perd ses sessions attribuées.
  if (platformRole !== "GESTIONNAIRE") await prisma.managerFormation.deleteMany({ where: { userId: id } });
  await audit(actor, "PLATFORM_ROLE_SET", { targetUserId: id, targetLabel: user.email, details: `${user.platformRole} → ${platformRole}` });
  return NextResponse.json({ ok: true });
}
