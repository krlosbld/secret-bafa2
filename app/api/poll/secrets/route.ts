import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveFormationId } from "@/lib/formation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const formationId = await getActiveFormationId();
  const secrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { player: { firstName: "asc" } },
  });

  return NextResponse.json({ secrets });
}
