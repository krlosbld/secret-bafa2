import { NextResponse } from "next/server";
import { getGameFormation } from "@/lib/gameFormation";
import { activeRulesForPlayers } from "@/lib/gameAnnouncements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Règles et pouvoirs actifs dans la session ouverte, présentés aux joueurs (fenêtre « ? »).
export async function GET() {
  const formation = await getGameFormation();
  if (!formation) return NextResponse.json({ rules: [] });
  return NextResponse.json({ rules: await activeRulesForPlayers(formation.id) });
}
