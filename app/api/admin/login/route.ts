import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { code } = await req.json();

  const adminCode = process.env.ADMIN_CODE;
  if (!adminCode) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CODE manquant dans .env" },
      { status: 500 }
    );
  }

  if (String(code || "").trim() !== adminCode) {
    return NextResponse.json({ ok: false, error: "Code invalide" }, { status: 401 });
  }

  // ✅ TEST RAPIDE : 10 secondes
  const ttlSeconds = 60 * 3;

  const untilMs = Date.now() + ttlSeconds * 1000;

  const res = NextResponse.json({ ok: true });

  res.cookies.set("admin_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    expires: new Date(untilMs),
  });

  // ✅ horodatage serveur (la vraie sécurité)
  res.cookies.set("admin_until", String(untilMs), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    expires: new Date(untilMs),
  });

  return res;
}