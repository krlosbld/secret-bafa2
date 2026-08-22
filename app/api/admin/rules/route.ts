import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { GAME_RULES } from "@/lib/gameRules";

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

  const rows = await prisma.config.findMany({
    where: { formationId, key: { in: GAME_RULES.map((r) => r.key) } },
  });
  const values = new Map(rows.map((r) => [r.key, r.value]));
  const rules = Object.fromEntries(GAME_RULES.map((r) => [r.key, values.get(r.key) === "true"]));

  return NextResponse.json({ rules });
}

export async function PATCH(req: Request) {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "");
  const enabled = body.enabled === true;

  if (!GAME_RULES.some((r) => r.key === key)) {
    return NextResponse.json({ error: "Règle inconnue." }, { status: 400 });
  }

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  await prisma.config.upsert({
    where: { formationId_key: { formationId, key } },
    update: { value: String(enabled) },
    create: { formationId, key, value: String(enabled) },
  });

  return NextResponse.json({ ok: true, key, enabled });
}
