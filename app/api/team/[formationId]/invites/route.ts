import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFormationManager } from "@/lib/teamAuth";
import { readJsonBody, str, limited, EMAIL_RE } from "@/lib/requestGuard";
import { normalizeEmail } from "@/lib/access";
import { createPersonalInvite } from "@/lib/invites";
import { sendTeamInviteEmail } from "@/lib/mail";
import { audit } from "@/lib/adminActor";

export const runtime = "nodejs";

const ROLE_LABELS: Record<string, string> = { DIRECTEUR: "Directeur", FORMATEUR: "Formateur" };

// Inviter un membre de l'équipe par email : un lien personnel de création de compte (ou de
// connexion) qui le rattache automatiquement à la session avec ce rôle.
export async function POST(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  const actor = await requireFormationManager(formationId);
  if (actor instanceof NextResponse) return actor;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const tooMany = limited(req, [{ key: `teaminvite:${actor.userId ?? "env"}`, max: 30, windowMs: 60 * 60 * 1000 }]);
  if (tooMany) return tooMany;

  const email = normalizeEmail(str(body.email, 300));
  const role = str(body.role, 30);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  if (!ROLE_LABELS[role]) return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });

  const [formation, existingUser] = await Promise.all([
    prisma.formation.findUnique({ where: { id: formationId }, select: { name: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true, platformRole: true, memberships: { where: { formationId }, select: { id: true } } } }),
  ]);
  if (!formation) return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  if (existingUser?.platformRole === "SUPERADMIN") {
    return NextResponse.json({ error: "Le compte super-admin n'est rattaché à aucune session." }, { status: 400 });
  }
  if (existingUser?.memberships.length) {
    return NextResponse.json({ error: "Cette personne fait déjà partie de cette session." }, { status: 400 });
  }

  const invite = await createPersonalInvite(formationId, email, role, actor.label);
  const mail = await sendTeamInviteEmail(email, formation.name, ROLE_LABELS[role], invite.token);
  await audit(actor, "TEAM_INVITE_SENT", { targetUserId: existingUser?.id ?? null, targetLabel: email, formationId, details: role });

  if (!mail.ok) {
    return NextResponse.json(
      { error: "L'invitation est créée, mais l'email n'a pas pu être envoyé. Réessayez dans quelques minutes." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, existingAccount: !!existingUser });
}
