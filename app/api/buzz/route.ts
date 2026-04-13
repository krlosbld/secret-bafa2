import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const buzzes = await prisma.buzz.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        secret: {
          select: {
            id: true,
            content: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ buzzes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { secretId, fromName, toName } = await req.json();

    if (!secretId || !fromName || !toName) {
      return NextResponse.json(
        { error: "Champs manquants" },
        { status: 400 }
      );
    }

    const buzz = await prisma.buzz.create({
      data: {
        secretId,
        fromName,
        toName,
      },
    });

    return NextResponse.json({ ok: true, buzz });
  } catch (error) {
    console.error("Erreur POST /api/buzz :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const result = await prisma.buzz.deleteMany({});

    return NextResponse.json({
      ok: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression globale" },
      { status: 500 }
    );
  }
}