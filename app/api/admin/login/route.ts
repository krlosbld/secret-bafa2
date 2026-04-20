import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookies } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Identifiant et mot de passe requis." },
        { status: 400 }
      );
    }

    // Super-admin
    if (
      username === process.env.SUPER_ADMIN_USERNAME &&
      password === process.env.SUPER_ADMIN_PASSWORD
    ) {
      const res = NextResponse.json({ ok: true, role: "superadmin" });
      setSessionCookies(res, { role: "superadmin" });
      return res;
    }

    // Gestionnaire
    const manager = await prisma.manager.findUnique({ where: { username } });
    if (manager) {
      const hash = crypto.createHash("sha256").update(password).digest("hex");
      if (hash === manager.passwordHash) {
        const res = NextResponse.json({ ok: true, role: "manager" });
        setSessionCookies(res, { role: "manager", managerId: manager.id });
        return res;
      }
    }

    return NextResponse.json(
      { ok: false, error: "Identifiants invalides." },
      { status: 401 }
    );
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return NextResponse.json({ ok: false, error: "Erreur serveur." }, { status: 500 });
  }
}
