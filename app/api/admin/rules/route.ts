import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { GAME_RULES, paramConfigKey } from "@/lib/gameRules";
import { getRuleSettings } from "@/lib/gameRuleSettings";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const settings = await getRuleSettings(formationId);
  const rules = Object.fromEntries(GAME_RULES.map((r) => [r.key, settings.enabled[r.key]]));
  return NextResponse.json({ rules, params: settings.params });
}

export async function PATCH(req: Request) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "");
  const enabled = body.enabled === true;

  // Seules les règles livrées sont modifiables (une règle déclarée mais pas encore disponible est refusée).
  const rule = GAME_RULES.find((r) => r.key === key);
  if (!rule) {
    return NextResponse.json({ error: "Règle inconnue." }, { status: 400 });
  }

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  // Paramètre chiffré : { key, param, value } — borné au min / max déclarés.
  if (typeof body.param === "string") {
    const param = rule.params?.find((p) => p.key === body.param);
    const value = Number(body.value);
    if (!param) return NextResponse.json({ error: "Paramètre inconnu." }, { status: 400 });
    if (!Number.isInteger(value) || value < param.min || value > param.max) {
      return NextResponse.json({ error: `${param.label} : entre ${param.min} et ${param.max}.` }, { status: 400 });
    }
    const k = paramConfigKey(rule.key, param.key);
    await prisma.config.upsert({
      where: { formationId_key: { formationId, key: k } },
      update: { value: String(value) },
      create: { formationId, key: k, value: String(value) },
    });
    return NextResponse.json({ ok: true, key, param: param.key, value });
  }

  await prisma.config.upsert({
    where: { formationId_key: { formationId, key } },
    update: { value: String(enabled) },
    create: { formationId, key, value: String(enabled) },
  });

  return NextResponse.json({ ok: true, key, enabled });
}
