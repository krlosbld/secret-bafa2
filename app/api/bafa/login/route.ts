import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setPlayerSessionCookies } from "@/lib/playerAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const cleanCode = String(code ?? "").trim();

    if (!/^\d{4}$/.test(cleanCode)) {
      return NextResponse.json({ ok: false, error: "Code invalide." }, { status: 400 });
    }

    const player = await prisma.player.findUnique({ where: { code: cleanCode } });
    if (!player) {
      return NextResponse.json({ ok: false, error: "Code inconnu." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    setPlayerSessionCookies(res, player.id);
    return res;
  } catch (e) {
    console.error("BAFA LOGIN ERROR:", e);
    return NextResponse.json({ ok: false, error: "Erreur serveur." }, { status: 500 });
  }
}
