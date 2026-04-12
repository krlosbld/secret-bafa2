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