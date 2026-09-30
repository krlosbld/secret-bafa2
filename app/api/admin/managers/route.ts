import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { username, password } = await req.json();
  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Identifiant et mot de passe requis." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const manager = await prisma.manager.create({
      data: { username: username.trim(), passwordHash },
      select: { id: true, username: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, manager });
  } catch {
    return NextResponse.json(
      { error: "Cet identifiant existe déjà." },
      { status: 409 }
    );
  }
}
