import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/teamAuth";
import { readJsonBody, str } from "@/lib/requestGuard";
import { hashPassword, passwordProblem } from "@/lib/password";
import { destroyAllUserSessions } from "@/lib/userSession";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

// Le super-admin définit un nouveau mot de passe pour un compte. Toutes les sessions ouvertes de
// ce compte sont fermées : la personne devra se reconnecter avec le nouveau mot de passe.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (actor instanceof NextResponse) return actor;
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const password = str(body.password, 300);
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await destroyAllUserSessions(id);
  await audit(actor, "USER_PASSWORD_SET", { targetUserId: id, targetLabel: user.email });
  return NextResponse.json({ ok: true });
}
