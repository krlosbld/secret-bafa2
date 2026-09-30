import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookies } from "@/lib/auth";
import { setPlayerSessionCookies } from "@/lib/playerAuth";
import { setDirectorAccountCookie } from "@/lib/directorAuth";
import { setFormationCookie } from "@/lib/formationSession";
import { verifyPassword, hashPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Identifiant et mot de passe requis." },
        { status: 400 }
      );
    }

    // Super-admin
    if (
      username === process.env.SUPER_ADMIN_USERNAME &&
      password === process.env.SUPER_ADMIN_PASSWORD
    ) {
      const res = NextResponse.json({ ok: true, role: "superadmin" });
      setSessionCookies(res, { role: "superadmin" });
      return res;
    }

    // Gestionnaire
    const manager = await prisma.manager.findUnique({ where: { username } });
    if (manager) {
      const check = await verifyPassword(password, manager.passwordHash);
      if (check.ok) {
        // Migration progressive : un ancien hachage SHA-256 est remplacé par scrypt dès la première connexion réussie.
        if (check.needsRehash) {
          await prisma.manager.update({ where: { id: manager.id }, data: { passwordHash: await hashPassword(password) } });
        }
        const res = NextResponse.json({ ok: true, role: "manager" });
        setSessionCookies(res, { role: "manager", managerId: manager.id });
        return res;
      }
    }

    // Directeur (identifiant/mot de passe, réutilisable sur plusieurs formations)
    const account = await prisma.directorAccount.findUnique({ where: { username } });
    if (account) {
      const check = await verifyPassword(password, account.passwordHash);
      if (check.ok) {
        if (check.needsRehash) {
          await prisma.directorAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
        }
        const players = await prisma.player.findMany({
          where: { directorAccountId: account.id },
          select: { id: true, formationId: true },
        });

        if (players.length === 0) {
          return NextResponse.json({ ok: false, error: "Ce compte n'est rattaché à aucune formation." }, { status: 401 });
        }

        const res = NextResponse.json({
          ok: true,
          role: "director",
          chooseFormation: players.length > 1,
        });
        setDirectorAccountCookie(res, account.id);
        if (players.length === 1) {
          setPlayerSessionCookies(res, players[0].id);
          setFormationCookie(res, players[0].formationId);
        }
        return res;
      }
    }

    return NextResponse.json(
      { ok: false, error: "Identifiants invalides." },
      { status: 401 }
    );
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return NextResponse.json({ ok: false, error: "Erreur serveur." }, { status: 500 });
  }
}
