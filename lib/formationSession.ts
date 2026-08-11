import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const FORMATION_COOKIE_TTL = 60 * 60 * 24 * 7; // 7 jours

type FormationCookieRow = { id: string; name: string; active: boolean };

export async function getFormationFromCookie(): Promise<FormationCookieRow | null> {
  const store = await cookies();
  const formationId = store.get("formation_id")?.value;
  if (!formationId) return null;

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, name: true, active: true },
  });
  return formation;
}

export function setFormationCookie(res: NextResponse, formationId: string) {
  res.cookies.set("formation_id", formationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FORMATION_COOKIE_TTL,
  });
}

export function clearFormationCookie(res: NextResponse) {
  res.cookies.set("formation_id", "", { maxAge: 0, path: "/" });
}
