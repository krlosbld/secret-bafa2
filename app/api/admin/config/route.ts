import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const quota = await prisma.config.findUnique({ where: { key: "buzzQuota" } });
  return NextResponse.json({ buzzQuota: Number(quota?.value ?? 3) });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { buzzQuota } = await req.json();
  const val = Number(buzzQuota);
  if (!Number.isInteger(val) || val < 1 || val > 20) {
    return NextResponse.json({ error: "Quota invalide (1-20)." }, { status: 400 });
  }

  await prisma.config.upsert({
    where: { key: "buzzQuota" },
    update: { value: String(val) },
    create: { key: "buzzQuota", value: String(val) },
  });

  return NextResponse.json({ ok: true, buzzQuota: val });
}
