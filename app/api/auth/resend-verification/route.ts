import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthToken } from "@/lib/authTokens";
import { sendVerificationEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/access";
import { readJsonBody, str, limited, EMAIL_RE } from "@/lib/requestGuard";

export const runtime = "nodejs";

const TEN_MIN = 10 * 60 * 1000;

// Renvoie l'email de confirmation. Réponse identique que le compte existe ou non, pour ne pas
// révéler quelles adresses sont inscrites.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const email = normalizeEmail(str(body.email, 300));
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });

  const tooMany = limited(req, [
    { key: "resend:{ip}", max: 5, windowMs: TEN_MIN },
    { key: `resend:${email}`, max: 3, windowMs: TEN_MIN },
  ]);
  if (tooMany) return tooMany;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, firstName: true, emailVerifiedAt: true } });
  if (user && !user.emailVerifiedAt) {
    const token = await createAuthToken(user.id, "VERIFY_EMAIL");
    const mail = await sendVerificationEmail(email, user.firstName, token);
    if (!mail.ok) {
      return NextResponse.json({ error: "L'email n'a pas pu être envoyé. Réessayez dans quelques minutes." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
