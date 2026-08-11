import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { canEditPlanning } from "@/lib/planningAuth";
import { getActiveFormationId } from "@/lib/formation";
import { buildPlayerReport } from "@/lib/playerReport";
import PlayerReportDocument from "@/lib/pdf/PlayerReportDocument";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const formationId = await getActiveFormationId();
  const report = await buildPlayerReport(id, formationId);
  if (!report) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // @react-pdf/renderer types renderToBuffer's argument as a <Document> element specifically;
  // our wrapper component renders one but isn't typed as such itself.
  const element = React.createElement(PlayerReportDocument, { report }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  const filename = report.firstName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename || "stagiaire"}.pdf"`,
    },
  });
}
