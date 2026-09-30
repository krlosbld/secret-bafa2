import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFormationManager } from "@/lib/teamAuth";
import { readJsonBody, str } from "@/lib/requestGuard";
import { addMember, TeamError } from "@/lib/team";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

// Ajouter un membre : rattachement immédiat d'un compte existant, avec son rôle dans la session.
export async function POST(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  const actor = await requireFormationManager(formationId);
  if (actor instanceof NextResponse) return actor;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const userId = str(body.userId, 50);
  const role = str(body.role, 30);
  const linkPlayerId = str(body.linkPlayerId, 50) || null;

  try {
    const member = await addMember(formationId, userId, role, linkPlayerId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    await audit(actor, "MEMBER_ADD", {
      targetUserId: userId,
      targetLabel: user?.email,
      formationId,
      details: `${role}${linkPlayerId ? " (fiche existante reliée)" : ""} — fiche « ${member.player?.firstName ?? "?"} »`,
    });
    return NextResponse.json({ ok: true, member });
  } catch (e) {
    if (e instanceof TeamError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
