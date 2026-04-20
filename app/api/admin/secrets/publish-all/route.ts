import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  await prisma.secret.updateMany({
    where: { status: "PENDING" },
    data: { status: "PUBLISHED" },
  });

  return NextResponse.json({ ok: true });
}
