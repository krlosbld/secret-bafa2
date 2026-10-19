import { NextResponse } from "next/server";
import { expireOverdueParticipants } from "@/lib/gameAccess";
import { expirePowers } from "@/lib/fakeIdentity";
import { settleExpiredBounties } from "@/lib/bounty";

export const runtime = "nodejs";

// Toutes les 15 minutes (crontab du serveur) : les participants acceptés depuis plus de 24 h sans
// aucune proposition de secret perdent leur participation, même s'ils ne se reconnectent pas ; les
// fausses identités arrivées à 24 h passent « expirées » (leur effet, lui, s'arrête de toute façon à l'heure).
// Header requis : Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    expired: await expireOverdueParticipants(),
    powersExpired: await expirePowers(),
    bountiesSettled: await settleExpiredBounties(), // mises à prix arrivées à 24 h : rendues (sauf bonne réponse en attente)
  });
}
