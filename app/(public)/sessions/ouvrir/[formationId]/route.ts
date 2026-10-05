import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/userSession";
import { setFormationCookie } from "@/lib/formationSession";
import { safeNextPath } from "@/lib/requestGuard";
import { ensureMemberPlayer } from "@/lib/team";

export const runtime = "nodejs";

// « Ouvrir » une session : contrôle côté serveur (connecté, email confirmé, rattaché à CETTE
// session), puis on entre dans le BAFA Manager existant avec la fiche Player du membre.
// L'identifiant dans l'URL ne donne rien à lui seul : sans rattachement, pas d'ouverture.
export async function GET(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  // Un préchargement (lien affiché à l'écran) ne doit jamais changer la session ouverte : seul un
  // vrai clic ouvre une session.
  if (req.headers.get("next-router-prefetch") || /prefetch/i.test(req.headers.get("sec-purpose") ?? req.headers.get("purpose") ?? "")) {
    return new NextResponse(null, { status: 204 });
  }

  const { formationId } = await params;
  const url = new URL(req.url);
  const origin = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("host") ?? url.host}`;
  const to = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const user = await getCurrentUser();
  if (!user) return to(`/login?next=${encodeURIComponent(`/sessions/ouvrir/${formationId}${url.search}`)}`);
  if (!user.emailVerifiedAt) return to("/login");

  const member = await prisma.formationMember.findUnique({
    where: { formationId_userId: { formationId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return to("/sessions?erreur=acces");

  await ensureMemberPlayer(member.id);
  const res = to(safeNextPath(url.searchParams.get("next"), "/bafa"));
  setFormationCookie(res, formationId);
  return res;
}
