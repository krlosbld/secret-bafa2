import { NextResponse } from "next/server";
import { clearPlayerSessionCookies } from "@/lib/playerAuth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearPlayerSessionCookies(res);
  return res;
}
