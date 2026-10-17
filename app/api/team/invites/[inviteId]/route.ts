import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeamInviter } from "@/lib/teamAuth";
import { readJsonBody } from "@/lib/requestGuard";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

// Annuler une invitation d'équipe en attente : son lien ne fonctionne plus.
export async function DELETE(req: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;
  const invite = await prisma.formationInvite.findUnique({ where: { id: inviteId }, select: { formationId: true, email: true, role: true, usedAt: true } });
  if (!invite || !invite.email) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
  const auth = await requireTeamInviter(invite.formationId);
  if (auth instanceof NextResponse) return auth;
  const { actor, formateursOnly } = auth;
  if (formateursOnly && invite.role !== "FORMATEUR") return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  await prisma.formationInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  await audit(actor, "TEAM_INVITE_REVOKED", { targetLabel: invite.email, formationId: invite.formationId });
  return NextResponse.json({ ok: true });
}
