import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { generateUniqueFormationCode } from "@/lib/formationCode";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, code: true, active: true, createdAt: true, _count: { select: { players: true } } },
  });

  return NextResponse.json({ ok: true, formations });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const existingDirectorAccountId = String(body.existingDirectorAccountId ?? "").trim() || null;
  const directorFirstName = String(body.directorFirstName ?? "").trim();
  const directorUsername = String(body.directorUsername ?? "").trim();
  const directorPassword = String(body.directorPassword ?? "").trim();
  const wantsNewDirector = !existingDirectorAccountId && directorFirstName;
  if (wantsNewDirector && (!directorUsername || !directorPassword)) {
    return NextResponse.json({ error: "Identifiant et mot de passe du directeur requis." }, { status: 400 });
  }

  const formationCode = await generateUniqueFormationCode();
  const startDate = body.startDate ? new Date(String(body.startDate)) : null;
  const endDate = body.endDate ? new Date(String(body.endDate)) : null;

  let formation, director;
  try {
    ({ formation, director } = await prisma.$transaction(async (tx) => {
      const formation = await tx.formation.create({ data: { name, code: formationCode, active: true, startDate, endDate } });

      let director = null;

      if (existingDirectorAccountId) {
        const account = await tx.directorAccount.findUnique({ where: { id: existingDirectorAccountId } });
        if (!account) throw new Error("DIRECTOR_ACCOUNT_NOT_FOUND");
        const hiddenCode = String(Math.floor(1000 + Math.random() * 9000));
        director = await tx.player.create({
          data: {
            firstName: account.firstName,
            code: hiddenCode,
            role: "DIRECTEUR",
            formationId: formation.id,
            directorAccountId: account.id,
          },
          select: { id: true, firstName: true },
        });
      } else if (wantsNewDirector) {
        const hiddenCode = String(Math.floor(1000 + Math.random() * 9000));
        const passwordHash = crypto.createHash("sha256").update(directorPassword).digest("hex");
        const account = await tx.directorAccount.create({
          data: { firstName: directorFirstName, username: directorUsername, passwordHash },
        });
        director = await tx.player.create({
          data: {
            firstName: directorFirstName,
            code: hiddenCode,
            role: "DIRECTEUR",
            formationId: formation.id,
            directorAccountId: account.id,
          },
          select: { id: true, firstName: true },
        });
      }

      return { formation, director };
    }));
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "DIRECTOR_ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Directeur introuvable." }, { status: 404 });
    }
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Cet identifiant directeur existe déjà." }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({
    ok: true,
    formation,
    director,
    directorCredentials: !existingDirectorAccountId && director ? { username: directorUsername } : null,
  });
}
