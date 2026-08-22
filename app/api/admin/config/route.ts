import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const rows = await prisma.config.findMany({ where: { formationId, key: { in: ["buzzQuota", "buzzPaused"] } } });
  const values = new Map(rows.map((r) => [r.key, r.value]));
  return NextResponse.json({
    buzzQuota: Number(values.get("buzzQuota") ?? 3),
    buzzPaused: values.get("buzzPaused") === "true",
  });
}

export async function PATCH(req: Request) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const updates: { key: string; value: string }[] = [];

  if (body.buzzQuota !== undefined) {
    const val = Number(body.buzzQuota);
    if (!Number.isInteger(val) || val < 1 || val > 20) {
      return NextResponse.json({ error: "Quota invalide (1-20)." }, { status: 400 });
    }
    updates.push({ key: "buzzQuota", value: String(val) });
  }
  if (typeof body.buzzPaused === "boolean") {
    updates.push({ key: "buzzPaused", value: String(body.buzzPaused) });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  await Promise.all(
    updates.map((u) =>
      prisma.config.upsert({
        where: { formationId_key: { formationId, key: u.key } },
        update: { value: u.value },
        create: { formationId, key: u.key, value: u.value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
