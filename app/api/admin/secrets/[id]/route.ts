import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIdFromUrl(req: Request) {
  const url = new URL(req.url);
  // /api/admin/secrets/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1); // dernier segment = id
}

export async function PATCH(req: Request) {
  try {
    const id = getIdFromUrl(req);
    if (!id || id === "secrets") {
      return NextResponse.json(
        { ok: false, message: "ID manquant dans l’URL." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.status === "PENDING" || body.status === "PUBLISHED") {
      data.status = body.status;
    }
    if (typeof body.showName === "boolean") {
      data.showName = body.showName;
    }
    if (typeof body.point === "number" && Number.isFinite(body.point)) {
      data.point = body.point;
    }

    const updated = await prisma.secret.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, secret: updated });
  } catch (e) {
    console.error("ADMIN SECRET PATCH ERROR:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const id = getIdFromUrl(req);
    if (!id || id === "secrets") {
      return NextResponse.json(
        { ok: false, message: "ID manquant dans l’URL." },
        { status: 400 }
      );
    }

    await prisma.secret.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ADMIN SECRET DELETE ERROR:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Erreur serveur." },
      { status: 500 }
    );
  }
}