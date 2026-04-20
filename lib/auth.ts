import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type AuthRole = "superadmin" | "manager";

export interface AuthSession {
  role: AuthRole;
  managerId?: string;
}

export const AUTH_TTL = 60 * 10; // 10 minutes

export async function getSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const role = store.get("auth_role")?.value as AuthRole | undefined;
  const until = Number(store.get("auth_until")?.value ?? "0");

  if (!role || !Number.isFinite(until) || Date.now() >= until) return null;

  if (role === "superadmin") return { role };

  if (role === "manager") {
    const managerId = store.get("auth_manager_id")?.value;
    if (!managerId) return null;
    return { role: "manager", managerId };
  }

  return null;
}

export function isSuperAdmin(session: AuthSession | null): boolean {
  return session?.role === "superadmin";
}

const cookieOpts = (ttl: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: ttl,
});

export function setSessionCookies(res: NextResponse, session: AuthSession) {
  const until = Date.now() + AUTH_TTL * 1000;
  const opts = cookieOpts(AUTH_TTL);
  res.cookies.set("auth_role", session.role, opts);
  res.cookies.set("auth_until", String(until), opts);
  if (session.managerId) {
    res.cookies.set("auth_manager_id", session.managerId, opts);
  }
}

export function clearSessionCookies(res: NextResponse) {
  const opts = { maxAge: 0, path: "/" };
  res.cookies.set("auth_role", "", opts);
  res.cookies.set("auth_until", "", opts);
  res.cookies.set("auth_manager_id", "", opts);
}
