import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { getOrCreateInvite, regenerateInvite, inviteUrl } from "@/lib/invites";
import { getVerifiedUser } from "@/lib/userSession";
import { getSuperAdminActor } from "@/lib/adminActor";

export const runtime = "nodejs";

// « Ajouter les stagiaires à la session » : lien + QR code d'invitation (directeurs, gestionnaire, admin).
// { regenerate: true } révoque le lien actuel et en crée un nouveau.
export async function POST(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  if (!(await canEditSessionSettings(formationId))) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const user = await getVerifiedUser();
  const actorLabel = user ? `${user.firstName} ${user.lastName} <${user.email}>` : (await getSuperAdminActor())?.label ?? "Directeur (accès par code)";

  const invite = body.regenerate === true ? await regenerateInvite(formationId, actorLabel) : await getOrCreateInvite(formationId, actorLabel);
  const url = inviteUrl(invite.token);
  const [qrSvg, qrPng, stagiaireCount] = await Promise.all([
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    QRCode.toDataURL(url, { margin: 2, width: 800, errorCorrectionLevel: "M" }),
    prisma.formationMember.count({ where: { formationId, role: "STAGIAIRE" } }),
  ]);

  return NextResponse.json({ ok: true, url, qrSvg, qrPng, joinCount: invite.joinCount, createdAt: invite.createdAt, stagiaireCount });
}
