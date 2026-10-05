import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUserSession } from "@/lib/userSession";
import { clearLegacyLoginCookies } from "@/lib/playerAuth";
import { normalizeEmail } from "@/lib/access";
import { readJsonBody, str, limited, safeNextPath } from "@/lib/requestGuard";
import { homePathFor } from "@/lib/mySessions";
import { getFormationFromCookie } from "@/lib/formationSession";

export const runtime = "nodejs";

const FIFTEEN_MIN = 15 * 60 * 1000;
const INVALID = "Email ou mot de passe incorrect.";

// Hachage factice : quand l'adresse est inconnue, on vérifie quand même un mot de passe pour que
// le temps de réponse ne révèle pas si le compte existe.
let dummyHash: Promise<string> | null = null;

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const email = normalizeEmail(str(body.email, 300));
  const password = str(body.password, 300);
  if (!email || !password) return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });

  const tooMany = limited(req, [
    { key: "login:{ip}", max: 20, windowMs: FIFTEEN_MIN },
    { key: `login:${email}`, max: 8, windowMs: FIFTEEN_MIN },
  ]);
  if (tooMany) return tooMany;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, platformRole: true },
  });

  if (!user) {
    dummyHash ??= hashPassword("mot-de-passe-factice-1");
    await verifyPassword(password, await dummyHash);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const check = await verifyPassword(password, user.passwordHash);
  if (!check.ok) return NextResponse.json({ error: INVALID }, { status: 401 });

  if (check.needsRehash) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }

  // Mot de passe correct mais adresse non confirmée : pas de session, l'espace BafaPilot reste fermé.
  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Votre adresse email n'est pas encore confirmée. Ouvrez le lien reçu par email.", code: "EMAIL_NOT_VERIFIED" },
      { status: 403 }
    );
  }

  // Le super-admin n'a pas de session : il arrive directement dans l'administration. Un stagiaire
  // arrive sur l'accueil de sa session ; l'équipe sur « Mes sessions ».
  const defaultNext =
    user.platformRole === "SUPERADMIN" ? "/admin" : await homePathFor(user.id, (await getFormationFromCookie())?.id ?? null);
  const requested = safeNextPath(body.next, defaultNext);
  const res = NextResponse.json({ ok: true, next: user.platformRole === "SUPERADMIN" && requested === "/sessions" ? "/admin" : requested });
  // Anciens cookies de connexion par code éventuellement restés sur ce navigateur : effacés.
  clearLegacyLoginCookies(res);
  await createUserSession(res, user.id, req.headers.get("user-agent"));
  return res;
}
