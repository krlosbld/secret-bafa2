import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPlanningAuth } from "@/lib/planningAuth";
import { prisma } from "@/lib/prisma";
import FinalAppraisalsDocument from "@/lib/pdf/FinalAppraisalsDocument";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const stagiaires = await prisma.player.findMany({
    where: { formationId: auth.formationId, role: "STAGIAIRE", active: true },
    orderBy: { firstName: "asc" },
    select: { firstName: true, code: true, finalAppraisal: true },
  });

  // @react-pdf/renderer types renderToBuffer's argument as a <Document> element specifically;
  // our wrapper component renders one but isn't typed as such itself.
  const element = React.createElement(FinalAppraisalsDocument, { items: stagiaires }) as unknown as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="appreciations_finales.pdf"`,
    },
  });
}
