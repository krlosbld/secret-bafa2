import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFormationManager } from "@/lib/teamAuth";

export const runtime = "nodejs";

// Recherche d'un compte existant (prénom, nom ou email) pour l'ajouter à l'équipe d'une session.
export async function GET(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  const actor = await requireFormationManager(formationId);
  if (actor instanceof NextResponse) return actor;

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const words = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const users = await prisma.user.findMany({
    where: {
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: "insensitive" as const } },
          { lastName: { contains: w, mode: "insensitive" as const } },
          { email: { contains: w, mode: "insensitive" as const } },
        ],
      })),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedAt: true,
      memberships: { where: { formationId }, select: { role: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      verified: !!u.emailVerifiedAt,
      alreadyMemberAs: u.memberships[0]?.role ?? null,
    })),
  });
}
