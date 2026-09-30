import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signCookie, verifyCookie, secureCookieBase } from "@/lib/signedCookie";

export const FORMATION_COOKIE_TTL = 60 * 60 * 24 * 7; // 7 jours

const COOKIE = "bp_formation";
type FormationPayload = { f: string; u: number };

type FormationCookieRow = { id: string; name: string; active: boolean; startDate: Date | null };

export async function getFormationFromCookie(): Promise<FormationCookieRow | null> {
  const store = await cookies();
  const data = verifyCookie<FormationPayload>(COOKIE, store.get(COOKIE)?.value);
  if (!data || typeof data.f !== "string" || !data.f || !Number.isFinite(data.u) || Date.now() >= data.u) return null;
  const formationId = data.f;

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, name: true, active: true, startDate: true },
  });
  return formation;
}

// Une formation inactive dont la date de début n'est pas encore atteinte n'a jamais commencé —
// à distinguer d'une formation inactive parce que terminée (message différent côté UI).
export function hasNotStartedYet(formation: { active: boolean; startDate: Date | null }): boolean {
  return !formation.active && !!formation.startDate && formation.startDate.getTime() > Date.now();
}

export function setFormationCookie(res: NextResponse, formationId: string) {
  const payload: FormationPayload = { f: formationId, u: Date.now() + FORMATION_COOKIE_TTL * 1000 };
  res.cookies.set(COOKIE, signCookie(COOKIE, payload), { ...secureCookieBase, maxAge: FORMATION_COOKIE_TTL });
}

export function clearFormationCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}
