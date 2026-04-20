import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.status === "PENDING" || body.status === "PUBLISHED" || body.status === "FOUND") {
    data.status = body.status;
  }
  if (typeof body.bonus === "number" && Number.isInteger(body.bonus) && body.bonus >= 1 && body.bonus <= 5) {
    data.bonus = body.bonus;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  }

  try {
    const updated = await prisma.secret.update({ where: { id }, data });
    return NextResponse.json({ ok: true, secret: updated });
  } catch (e) {
    console.error("ADMIN SECRET PATCH ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.secret.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ADMIN SECRET DELETE ERROR:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
