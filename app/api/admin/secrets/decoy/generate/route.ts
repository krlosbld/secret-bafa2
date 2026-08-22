import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { resolveAdminFormationId } from "@/lib/formation";
import { findNameCollision } from "@/lib/nameCollision";
import { generateAiDecoy } from "@/lib/aiDecoy";
import { randomDecoy } from "@/lib/decoySecrets";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }

  const [realSecrets, players] = await Promise.all([
    prisma.secret.findMany({
      where: { formationId, isDecoy: false, status: { in: ["PUBLISHED", "FOUND"] } },
      select: { content: true },
    }),
    prisma.player.findMany({ where: { formationId }, select: { firstName: true } }),
  ]);
  const realContents = realSecrets.map((s) => s.content);
  const existingNames = players.map((p) => p.firstName);

  // Deux essais IA (au cas où le prénom proposé collisionne malgré la liste déjà fournie), puis
  // repli sur la liste écrite à l'avance si l'IA ne répond pas du tout — pour ne jamais bloquer
  // l'admin qui veut créer un faux secret.
  for (let i = 0; i < 2; i++) {
    const proposal = await generateAiDecoy(realContents, existingNames);
    if (!proposal) break;
    const collision = await findNameCollision(formationId, proposal.firstName);
    if (!collision) {
      return NextResponse.json({ ok: true, ...proposal, source: "ai" });
    }
  }

  for (let i = 0; i < 10; i++) {
    const proposal = randomDecoy();
    const collision = await findNameCollision(formationId, proposal.firstName);
    if (!collision) {
      return NextResponse.json({ ok: true, ...proposal, source: "fallback" });
    }
  }

  return NextResponse.json({ error: "Impossible de proposer un faux secret sans collision, réessaie." }, { status: 409 });
}
