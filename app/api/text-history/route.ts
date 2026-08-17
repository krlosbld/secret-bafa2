import { NextResponse } from "next/server";
import { getPlanningAuth } from "@/lib/planningAuth";
import { getTextHistory } from "@/lib/textHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["evaluation", "dailyRemark", "ems", "retourEms", "complementaryNote", "finalAppraisal"];

export async function GET(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") ?? "";
  const entityKey = url.searchParams.get("entityKey") ?? "";
  if (!ALLOWED_TYPES.includes(entityType) || !entityKey) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const history = await getTextHistory(auth.formationId, entityType, entityKey);
  return NextResponse.json({ ok: true, history });
}
