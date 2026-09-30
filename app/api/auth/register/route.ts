import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/password";
import { createAuthToken } from "@/lib/authTokens";
import { sendVerificationEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/access";
import { readJsonBody, str, limited, EMAIL_RE } from "@/lib/requestGuard";

export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const tooMany = limited(req, [{ key: "register:{ip}", max: 10, windowMs: HOUR }]);
  if (tooMany) return tooMany;

  const firstName = str(body.firstName, 100).trim();
  const lastName = str(body.lastName, 100).trim();
  const email = normalizeEmail(str(body.email, 300));
  const password = str(body.password, 300);
  const confirm = str(body.confirm, 300);

  if (!firstName || !lastName) return NextResponse.json({ error: "Le prénom et le nom sont obligatoires." }, { status: 400 });
  if (firstName.length > 60 || lastName.length > 60) return NextResponse.json({ error: "Le prénom ou le nom est trop long." }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "Les deux mots de passe ne correspondent pas." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email.", code: "EMAIL_TAKEN" }, { status: 409 });
  }

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    userId = user.id;
  } catch (e: unknown) {
    // Deux inscriptions simultanées avec la même adresse : la contrainte unique tranche.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email.", code: "EMAIL_TAKEN" }, { status: 409 });
    }
    throw e;
  }

  const token = await createAuthToken(userId, "VERIFY_EMAIL");
  const mail = await sendVerificationEmail(email, firstName, token);

  return NextResponse.json({ ok: true, email, mailSent: mail.ok });
}
