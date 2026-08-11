import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getPlayerSession } from "@/lib/playerAuth";
import { generateUniquePlayerCode } from "@/lib/playerCode";
import crypto from "crypto";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// POST : créer un code (stagiaire/formateur) ou un directeur (nouveau ou déjà existant) dans cette formation.
// Autorisé au super-admin (sans restriction) ou au directeur de cette formation (stagiaire/formateur seulement).
export async function POST(req: Request, { params }: Params) {
  const { id: formationId } = await params;

  const session = await getSession();
  const isSuper = isSuperAdmin(session);
  let isDirectorOfFormation = false;
  if (!isSuper) {
    const playerSession = await getPlayerSession();
    if (playerSession) {
      const requester = await prisma.player.findUnique({
        where: { id: playerSession.playerId },
        select: { role: true, formationId: true },
      });
      isDirectorOfFormation = requester?.role === "DIRECTEUR" && requester.formationId === formationId;
    }
  }
  if (!isSuper && !isDirectorOfFormation) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const role = body.role === "STAGIAIRE" || body.role === "FORMATEUR" || body.role === "DIRECTEUR" ? body.role : "DIRECTEUR";

  if (role === "DIRECTEUR" && !isSuper) {
    return NextResponse.json({ error: "Seul le super-admin peut créer un compte directeur." }, { status: 403 });
  }

  if (role === "DIRECTEUR") {
    const existingDirectorAccountId = String(body.existingDirectorAccountId ?? "").trim() || null;

    if (existingDirectorAccountId) {
      const account = await prisma.directorAccount.findUnique({ where: { id: existingDirectorAccountId } });
      if (!account) return NextResponse.json({ error: "Directeur introuvable." }, { status: 404 });

      const code = await generateUniquePlayerCode(formationId); // valeur cachée, jamais communiquée
      const player = await prisma.player.create({
        data: { firstName: account.firstName, code, role, formationId, directorAccountId: account.id },
        select: { id: true, firstName: true, role: true },
      });
      return NextResponse.json({ ok: true, player: { ...player, code: null, username: null } });
    }

    const firstName = String(body.firstName ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "").trim();
    if (!firstName || !username || !password) {
      return NextResponse.json({ error: "Prénom, identifiant et mot de passe requis." }, { status: 400 });
    }

    const code = await generateUniquePlayerCode(formationId); // valeur cachée, jamais communiquée
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    try {
      const account = await prisma.directorAccount.create({ data: { firstName, username, passwordHash } });
      const player = await prisma.player.create({
        data: { firstName, code, role, formationId, directorAccountId: account.id },
        select: { id: true, firstName: true, role: true },
      });
      return NextResponse.json({ ok: true, player: { ...player, code: null, username } });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "Cet identifiant existe déjà." }, { status: 409 });
      }
      throw e;
    }
  }

  const firstName = String(body.firstName ?? "").trim();
  if (!firstName) {
    return NextResponse.json({ error: "Prénom requis." }, { status: 400 });
  }
  const code = await generateUniquePlayerCode(formationId);
  const player = await prisma.player.create({
    data: { firstName, code, role, formationId },
    select: { id: true, firstName: true, code: true, role: true },
  });

  return NextResponse.json({ ok: true, player: { ...player, username: null } });
}
