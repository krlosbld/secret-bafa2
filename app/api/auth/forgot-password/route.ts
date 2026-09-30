import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthToken } from "@/lib/authTokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/access";
import { readJsonBody, str, limited, EMAIL_RE } from "@/lib/requestGuard";

export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;

// Mot de passe oublié : la réponse est toujours la même, que l'adresse corresponde à un compte ou
// non, pour ne pas révéler quelles adresses sont inscrites.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const email = normalizeEmail(str(body.email, 300));
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });

  const tooMany = limited(req, [
    { key: "forgot:{ip}", max: 10, windowMs: HOUR },
    { key: `forgot:${email}`, max: 3, windowMs: HOUR },
  ]);
  if (tooMany) return tooMany;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, firstName: true } });
  if (user) {
    const token = await createAuthToken(user.id, "RESET_PASSWORD");
    const mail = await sendPasswordResetEmail(email, user.firstName, token);
    if (!mail.ok) console.error("FORGOT PASSWORD: email non envoyé pour le compte", user.id);
  }

  return NextResponse.json({ ok: true });
}
