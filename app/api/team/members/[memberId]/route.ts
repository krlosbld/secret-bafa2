import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFormationManager } from "@/lib/teamAuth";
import { readJsonBody, str } from "@/lib/requestGuard";
import { isMemberRole } from "@/lib/access";
import { setMemberRole, removeMember } from "@/lib/team";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

async function loadMember(memberId: string) {
  return prisma.formationMember.findUnique({
    where: { id: memberId },
    select: { id: true, formationId: true, role: true, userId: true, user: { select: { email: true } } },
  });
}

// Changer le rôle d'un membre (Directeur / Formateur) dans sa session.
export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const member = await loadMember(memberId);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  const actor = await requireFormationManager(member.formationId);
  if (actor instanceof NextResponse) return actor;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const role = str(body.role, 30);
  if (!isMemberRole(role)) return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });

  await setMemberRole(memberId, role);
  await audit(actor, "MEMBER_ROLE_SET", { targetUserId: member.userId, targetLabel: member.user.email, formationId: member.formationId, details: `${member.role} → ${role}` });
  return NextResponse.json({ ok: true });
}

// Retirer un membre de l'équipe : le lien est supprimé, la fiche Player et son historique restent.
export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const member = await loadMember(memberId);
  if (!member) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  const actor = await requireFormationManager(member.formationId);
  if (actor instanceof NextResponse) return actor;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  await removeMember(memberId);
  await audit(actor, "MEMBER_REMOVE", { targetUserId: member.userId, targetLabel: member.user.email, formationId: member.formationId, details: member.role });
  return NextResponse.json({ ok: true });
}
