import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = String(body.firstName ?? "").trim();
    const content = String(body.content ?? "").trim();

    if (!firstName || !content) {
      return NextResponse.json(
        { ok: false, message: "Prénom et secret obligatoires." },
        { status: 400 }
      );
    }

    await prisma.secret.create({
      data: {
        authorFirstName: firstName,
        content,
        status: "PENDING",
        showName: false,
        point: 0,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API SUBMIT ERROR:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Erreur serveur." },
      { status: 500 }
    );
  }
}