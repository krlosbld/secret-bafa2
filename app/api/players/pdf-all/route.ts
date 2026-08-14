import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPlanningAuth } from "@/lib/planningAuth";
import { prisma } from "@/lib/prisma";
import { buildPlayerReport } from "@/lib/playerReport";
import AllPlayersReportDocument from "@/lib/pdf/AllPlayersReportDocument";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const stagiaires = await prisma.player.findMany({
    where: { formationId: auth.formationId, role: "STAGIAIRE", active: true },
    orderBy: { firstName: "asc" },
    select: { id: true },
  });

  const reports = (
    await Promise.all(stagiaires.map((s) => buildPlayerReport(s.id, auth.formationId)))
  ).filter((r): r is NonNullable<typeof r> => !!r);

  // @react-pdf/renderer types renderToBuffer's argument as a <Document> element specifically;
  // our wrapper component renders one but isn't typed as such itself.
  const element = React.createElement(AllPlayersReportDocument, { reports }) as unknown as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossiers_stagiaires.pdf"`,
    },
  });
}
