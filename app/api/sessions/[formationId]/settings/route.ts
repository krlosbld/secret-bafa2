import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/requestGuard";
import { updateSessionSettings, canEditSessionSettings, SettingsError } from "@/lib/sessionSettings";

export const runtime = "nodejs";

// Réglages d'une session (nom, type, date de début, lieu) : admin, gestionnaire ou directeur de la session.
export async function PATCH(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  if (!(await canEditSessionSettings(formationId))) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  try {
    const settings = await updateSessionSettings(formationId, body);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    if (e instanceof SettingsError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
