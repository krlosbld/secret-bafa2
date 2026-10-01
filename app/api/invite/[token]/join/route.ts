import { NextResponse } from "next/server";
import { readJsonBody, limited } from "@/lib/requestGuard";
import { getVerifiedUser } from "@/lib/userSession";
import { joinWithInvite } from "@/lib/invites";
import { openSessionPath } from "@/lib/mySessions";
import { TeamError } from "@/lib/team";

export const runtime = "nodejs";

// Rejoindre une session avec le lien d'invitation : compte connecté et email confirmé requis.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  const tooMany = limited(req, [{ key: "join:{ip}", max: 30, windowMs: 15 * 60 * 1000 }]);
  if (tooMany) return tooMany;

  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "Connectez-vous pour rejoindre la session." }, { status: 401 });
  if (user.impersonatorId) return NextResponse.json({ error: "Action impossible pendant une connexion « en tant que »." }, { status: 403 });

  const { token } = await params;
  try {
    const { formationId } = await joinWithInvite(user.id, token);
    return NextResponse.json({ ok: true, next: openSessionPath(formationId) });
  } catch (e) {
    if (e instanceof TeamError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
