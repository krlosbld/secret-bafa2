import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/requestGuard";
import { canEditSessionSettings } from "@/lib/sessionSettings";
import { saveStagiaireColumns, ColumnsError } from "@/lib/stagiaireColumns";

export const runtime = "nodejs";

// Colonnes de la vue « Stagiaires » d'une session (directeurs, gestionnaire, admin).
export async function PATCH(req: Request, { params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  if (!(await canEditSessionSettings(formationId))) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  try {
    const columns = await saveStagiaireColumns(formationId, body.columns);
    return NextResponse.json({ ok: true, columns });
  } catch (e) {
    if (e instanceof ColumnsError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
