import { NextResponse } from "next/server";
import { getSecretsAdminAuth } from "@/lib/gameAdminAuth";
import { getGameMasterAuth } from "@/lib/gameAccess";
import { resolveAdminFormationId } from "@/lib/formation";
import { audit } from "@/lib/adminActor";
import { convertSecretToDecoy, ConversionError } from "@/lib/secretConversion";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Maître du jeu : transformer un vrai secret (validé, pas encore trouvé) en faux secret.
export async function POST(_req: Request, { params }: Params) {
  const auth = await getSecretsAdminAuth();
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let formationId = auth.formationId;
  if (!formationId) {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok) return NextResponse.json({ error: "Choisis une formation." }, { status: 409 });
    formationId = resolved.formationId;
  }
  const { id } = await params;
  try {
    const done = await convertSecretToDecoy({ formationId, secretId: id });
    const gm = await getGameMasterAuth();
    await audit({ kind: "directeur", userId: null, label: gm.ok ? gm.label : "Administration" }, "SECRET_TO_DECOY", {
      formationId,
      details: `Secret de ${done.authorFirstName} transformé en faux secret (prénom inventé : ${done.decoyFirstName})`,
    });
    return NextResponse.json({ ok: true, ...done });
  } catch (e) {
    if (e instanceof ConversionError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
