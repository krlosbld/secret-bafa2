import { NextResponse } from "next/server";
import { destroyCurrentUserSession } from "@/lib/userSession";
import { readJsonBody } from "@/lib/requestGuard";

export const runtime = "nodejs";

// Supprime la session en base (invalidation immédiate) et efface le cookie.
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const res = NextResponse.json({ ok: true });
  await destroyCurrentUserSession(res);
  return res;
}
