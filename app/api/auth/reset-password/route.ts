import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/password";
import { consumeAuthToken } from "@/lib/authTokens";
import { destroyAllUserSessions } from "@/lib/userSession";
import { readJsonBody, str, limited } from "@/lib/requestGuard";

export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;

const REASONS: Record<string, string> = {
  invalid: "Ce lien de réinitialisation n'est pas valide.",
  used: "Ce lien a déjà été utilisé ou a été remplacé par un lien plus récent.",
  expired: "Ce lien a expiré. Demandez-en un nouveau.",
};

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const tooMany = limited(req, [{ key: "reset:{ip}", max: 10, windowMs: HOUR }]);
  if (tooMany) return tooMany;

  const token = str(body.token, 200);
  const password = str(body.password, 300);
  const confirm = str(body.confirm, 300);

  // Le mot de passe est validé AVANT de consommer le jeton : une erreur de saisie ne grille pas le lien.
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "Les deux mots de passe ne correspondent pas." }, { status: 400 });

  const result = await consumeAuthToken(token, "RESET_PASSWORD");
  if (!result.ok) return NextResponse.json({ error: REASONS[result.reason], code: result.reason }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: result.userId }, select: { emailVerifiedAt: true } });
  await prisma.user.update({
    where: { id: result.userId },
    // Recevoir le lien prouve l'accès à la boîte mail : l'adresse est confirmée au passage.
    data: { passwordHash: await hashPassword(password), ...(user?.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) },
  });
  // Toutes les sessions ouvertes avec l'ancien mot de passe sont fermées.
  await destroyAllUserSessions(result.userId);

  return NextResponse.json({ ok: true });
}
