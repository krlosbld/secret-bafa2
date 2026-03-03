import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ preuve que le proxy tourne
  const res = NextResponse.next();
  res.headers.set("x-proxy-hit", "1");

  // Laisser passer la page login + l'api login
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/login")) {
    return res;
  }

  // Protéger /admin et /admin/*
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const ok = req.cookies.get("admin_auth")?.value === "1";
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    // anti cache
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};