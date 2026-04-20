import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const secrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] } },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ secrets });
}
