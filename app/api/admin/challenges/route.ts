import { NextResponse, after } from "next/server";
import { getGameAdminAuth } from "@/lib/gameAdminAuth";
import { getGameMasterAuth } from "@/lib/gameAccess";
import { resolveAdminFormationId } from "@/lib/formation";
import { ChallengeError, challengeRecipientsChoice, challengesForAdmin, createChallenge, sendChallengeMails } from "@/lib/gameChallenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function formationOf(): Promise<{ ok: true; formationId: string } | { ok: false; res: NextResponse }> {
  const auth = await getGameAdminAuth();
  if (!auth.ok) return { ok: false, res: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  if (auth.formationId) return { ok: true, formationId: auth.formationId };
  const resolved = await resolveAdminFormationId();
  if (!resolved.ok) return { ok: false, res: NextResponse.json({ error: "Choisis une formation." }, { status: 409 }) };
  return { ok: true, formationId: resolved.formationId };
}

// Défis (maître du jeu) : joueurs à qui en envoyer, et suivi des 30 derniers.
export async function GET() {
  const f = await formationOf();
  if (!f.ok) return f.res;
  const [players, challenges] = await Promise.all([challengeRecipientsChoice(f.formationId), challengesForAdmin(f.formationId)]);
  return NextResponse.json({ ok: true, players, challenges });
}

// Nouveau défi : { text, deadline?: ISO | null, playerIds: string[] | "ALL" }. Les emails partent après
// la réponse (un par un) ; le suivi affiche leur état.
export async function POST(req: Request) {
  const f = await formationOf();
  if (!f.ok) return f.res;
  const body = await req.json().catch(() => ({}));
  const deadline = body.deadline ? new Date(body.deadline) : null;
  if (deadline && Number.isNaN(deadline.getTime())) return NextResponse.json({ error: "Date limite invalide." }, { status: 400 });
  const playerIds = body.playerIds === "ALL" ? "ALL" : Array.isArray(body.playerIds) ? body.playerIds.filter((x: unknown) => typeof x === "string") : [];
  const gm = await getGameMasterAuth();
  try {
    const id = await createChallenge({
      formationId: f.formationId,
      text: typeof body.text === "string" ? body.text : "",
      deadline,
      playerIds,
      actorLabel: gm.ok ? gm.label : "Administration",
    });
    after(() => sendChallengeMails(id).catch((e) => console.error("CHALLENGE: emails non envoyés", id, e)));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof ChallengeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
