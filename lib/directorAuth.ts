import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const DIRECTOR_ACCOUNT_TTL = 60 * 10; // 10 minutes, glissant (comme les autres sessions)

export async function getDirectorAccountSession(): Promise<{ directorAccountId: string } | null> {
  const store = await cookies();
  const directorAccountId = store.get("director_account_id")?.value;
  const until = Number(store.get("director_account_until")?.value ?? "0");

  if (!directorAccountId || !Number.isFinite(until) || Date.now() >= until) return null;
  if (until - Date.now() > DIRECTOR_ACCOUNT_TTL * 1000 + 5000) return null;

  return { directorAccountId };
}

export function setDirectorAccountCookie(res: NextResponse, directorAccountId: string) {
  const until = Date.now() + DIRECTOR_ACCOUNT_TTL * 1000;
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DIRECTOR_ACCOUNT_TTL,
  };
  res.cookies.set("director_account_id", directorAccountId, opts);
  res.cookies.set("director_account_until", String(until), opts);
}

export function clearDirectorAccountCookie(res: NextResponse) {
  const opts = { maxAge: 0, path: "/" };
  res.cookies.set("director_account_id", "", opts);
  res.cookies.set("director_account_until", "", opts);
}
