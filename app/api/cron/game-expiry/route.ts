import { NextResponse } from "next/server";
import { expireOverdueParticipants } from "@/lib/gameAccess";

export const runtime = "nodejs";

// Toutes les 15 minutes (crontab du serveur) : les participants acceptés depuis plus de 24 h sans
// aucune proposition de secret perdent leur participation, même s'ils ne se reconnectent pas.
// Header requis : Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, expired: await expireOverdueParticipants() });
}
