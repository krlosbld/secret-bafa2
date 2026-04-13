import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}