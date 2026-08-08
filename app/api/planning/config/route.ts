import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditPlanning } from "@/lib/planningAuth";
import { SESSION_TYPES, DEFAULT_SESSION_TYPE, todayISO } from "@/lib/planningConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.config.findMany({
    where: { key: { in: ["planningSessionType", "planningStartDate"] } },
  });
  const sessionType = rows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = rows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  return NextResponse.json({ ok: true, sessionType, startDate });
}

export async function PATCH(req: Request) {
  if (!(await canEditPlanning())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sessionType, startDate } = body;

  if (typeof sessionType !== "string" || !Object.keys(SESSION_TYPES).includes(sessionType)) {
    return NextResponse.json({ error: "Type de formation invalide." }, { status: 400 });
  }
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.config.upsert({
      where: { key: "planningSessionType" },
      update: { value: sessionType },
      create: { key: "planningSessionType", value: sessionType },
    }),
    prisma.config.upsert({
      where: { key: "planningStartDate" },
      update: { value: startDate },
      create: { key: "planningStartDate", value: startDate },
    }),
  ]);

  return NextResponse.json({ ok: true, sessionType, startDate });
}
