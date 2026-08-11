import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDirectorAccountSession } from "@/lib/directorAuth";
import { setPlayerSessionCookies } from "@/lib/playerAuth";
import { setFormationCookie } from "@/lib/formationSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getDirectorAccountSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  if (!playerId) {
    return NextResponse.json({ error: "playerId requis." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { directorAccountId: true, formationId: true } });
  if (!player || player.directorAccountId !== session.directorAccountId) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setPlayerSessionCookies(res, playerId);
  setFormationCookie(res, player.formationId);
  return res;
}
