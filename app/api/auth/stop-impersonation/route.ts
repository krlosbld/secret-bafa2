import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/requestGuard";
import { getCurrentUser, stopImpersonation } from "@/lib/userSession";
import { audit, LEGACY_SUPERADMIN } from "@/lib/adminActor";

export const runtime = "nodejs";

// « Revenir à mon compte » : ferme la session « en tant que » et rend au super-admin sa propre session.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const current = await getCurrentUser();
  const res = NextResponse.json({ ok: true, next: current ? `/admin/utilisateurs/${current.id}` : "/admin/utilisateurs" });
  const { targetUserId } = await stopImpersonation(res);

  if (targetUserId && current?.impersonatorId) {
    const actorUser =
      current.impersonatorId === LEGACY_SUPERADMIN
        ? null
        : await prisma.user.findUnique({ where: { id: current.impersonatorId }, select: { id: true, firstName: true, lastName: true, email: true } });
    await audit(
      { kind: "superadmin", userId: actorUser?.id ?? null, label: actorUser ? `${actorUser.firstName} ${actorUser.lastName} <${actorUser.email}>` : "Super-admin (.env)" },
      "IMPERSONATE_END",
      { targetUserId, targetLabel: current.email }
    );
  }
  return res;
}
