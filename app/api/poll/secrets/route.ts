import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFormationFromCookie } from "@/lib/formationSession";
import { isSecretCurrentlyVisible } from "@/lib/secretVisibility";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formation = await getFormationFromCookie();
  if (!formation) return NextResponse.json({ secrets: [] });

  const allSecrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId: formation.id },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      limitedVisibility: true,
      limitedVisibilitySince: true,
      limitedVisibilityMinutes: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { player: { firstName: "asc" } },
  });
  const secrets = allSecrets.filter(isSecretCurrentlyVisible);

  return NextResponse.json({ secrets });
}
