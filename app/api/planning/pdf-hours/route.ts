import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPlanningAuth } from "@/lib/planningAuth";
import { prisma } from "@/lib/prisma";
import { buildCategoryGroups } from "@/lib/planningExport";
import TrainingHoursDocument from "@/lib/pdf/TrainingHoursDocument";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getPlanningAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const categoriesParam = new URL(req.url).searchParams.get("categories");
  const selectedKeys = categoriesParam ? categoriesParam.split(",").filter(Boolean) : null;

  const [formation, { groups, totalMinutes }] = await Promise.all([
    prisma.formation.findUnique({ where: { id: auth.formationId }, select: { name: true } }),
    buildCategoryGroups(auth.formationId, selectedKeys),
  ]);

  // @react-pdf/renderer types renderToBuffer's argument as a <Document> element specifically;
  // our wrapper component renders one but isn't typed as such itself.
  const element = React.createElement(TrainingHoursDocument, {
    formationName: formation?.name ?? "",
    groups,
    totalMinutes,
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="temps_de_formation.pdf"`,
    },
  });
}
