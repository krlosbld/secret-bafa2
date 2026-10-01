import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { stopImpersonation } from "@/lib/userSession";
import { audit, LEGACY_SUPERADMIN } from "@/lib/adminActor";

export const runtime = "nodejs";

// « Revenir à mon compte » (bouton, ou automatiquement au bout d'une heure) : ferme la session
// « en tant que », rend au super-admin sa propre session et le ramène sur la fiche du compte.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const res = NextResponse.json({ ok: true });
  const { targetUserId, targetEmail, impersonatorId } = await stopImpersonation(res);
  const next = targetUserId ? `/admin/utilisateurs/${targetUserId}` : "/admin/utilisateurs";

  if (targetUserId && impersonatorId) {
    const actorUser =
      impersonatorId === LEGACY_SUPERADMIN
        ? null
        : await prisma.user.findUnique({ where: { id: impersonatorId }, select: { id: true, firstName: true, lastName: true, email: true } });
    await audit(
      { kind: "superadmin", userId: actorUser?.id ?? null, label: actorUser ? `${actorUser.firstName} ${actorUser.lastName} <${actorUser.email}>` : "Super-admin (.env)" },
      "IMPERSONATE_END",
      { targetUserId, targetLabel: targetEmail }
    );
  }

  // La réponse doit porter les cookies posés par stopImpersonation : on y ajoute la destination.
  const out = NextResponse.json({ ok: true, next });
  for (const c of res.cookies.getAll()) out.cookies.set(c);
  return out;
}
