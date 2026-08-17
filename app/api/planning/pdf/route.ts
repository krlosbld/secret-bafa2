import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPlanningAuth } from "@/lib/planningAuth";
import { prisma } from "@/lib/prisma";
import { buildGridModel } from "@/lib/planningExport";
import PlanningDocument from "@/lib/pdf/PlanningDocument";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const [formation, { days }] = await Promise.all([
    prisma.formation.findUnique({ where: { id: auth.formationId }, select: { name: true } }),
    buildGridModel(auth.formationId),
  ]);

  // @react-pdf/renderer types renderToBuffer's argument as a <Document> element specifically;
  // our wrapper component renders one but isn't typed as such itself.
  const element = React.createElement(PlanningDocument, {
    formationName: formation?.name ?? "",
    days,
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="planning.pdf"`,
    },
  });
}
