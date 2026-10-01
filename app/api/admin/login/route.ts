import { NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth";

export const runtime = "nodejs";

// Connexion de secours du super-admin (identifiants du .env). Tous les autres accès passent par
// les comptes BafaPilot (/login) : les anciens comptes directeur et gestionnaire à identifiant ne
// permettent plus de se connecter.
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Identifiant et mot de passe requis." }, { status: 400 });
    }

    if (
      process.env.SUPER_ADMIN_USERNAME &&
      process.env.SUPER_ADMIN_PASSWORD &&
      username === process.env.SUPER_ADMIN_USERNAME &&
      password === process.env.SUPER_ADMIN_PASSWORD
    ) {
      const res = NextResponse.json({ ok: true, role: "superadmin" });
      setSessionCookies(res, { role: "superadmin" });
      return res;
    }

    return NextResponse.json({ ok: false, error: "Identifiants invalides." }, { status: 401 });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return NextResponse.json({ ok: false, error: "Erreur serveur." }, { status: 500 });
  }
}
