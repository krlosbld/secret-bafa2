import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";
import { destroyCurrentUserSession } from "@/lib/userSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  // Un super-admin connecté avec son compte BafaPilot doit aussi être réellement déconnecté.
  await destroyCurrentUserSession(res);
  return res;
}
