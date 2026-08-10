import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { getActiveFormationId } from "@/lib/formation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const formationId = auth.formationId ?? (await getActiveFormationId());
  const quota = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "buzzQuota" } } });
  return NextResponse.json({ buzzQuota: Number(quota?.value ?? 3) });
}

export async function PATCH(req: Request) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { buzzQuota } = await req.json();
  const val = Number(buzzQuota);
  if (!Number.isInteger(val) || val < 1 || val > 20) {
    return NextResponse.json({ error: "Quota invalide (1-20)." }, { status: 400 });
  }

  const formationId = auth.formationId ?? (await getActiveFormationId());
  await prisma.config.upsert({
    where: { formationId_key: { formationId, key: "buzzQuota" } },
    update: { value: String(val) },
    create: { formationId, key: "buzzQuota", value: String(val) },
  });

  return NextResponse.json({ ok: true, buzzQuota: val });
}
