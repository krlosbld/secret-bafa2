import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { addMember, TeamError } from "@/lib/team";
import { matchesName } from "@/lib/nameCollision";
import { appUrl } from "@/lib/mail";

// Lien d'invitation (QR code) d'une session : « Ajouter les stagiaires à la session ». En l'ouvrant,
// on crée son compte ou on se connecte, puis on est rattaché automatiquement en Stagiaire.

export const invitePath = (token: string) => `/rejoindre/${token}`;
export const inviteUrl = (token: string) => appUrl(invitePath(token));

export const PERSONAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // invitation d'équipe : 7 jours

// Lien partagé (QR code stagiaires) actif de la session, créé au premier besoin.
export async function getOrCreateInvite(formationId: string, actorLabel: string) {
  const current = await prisma.formationInvite.findFirst({
    where: { formationId, revokedAt: null, role: "STAGIAIRE", email: null },
    orderBy: { createdAt: "desc" },
  });
  if (current) return current;
  return prisma.formationInvite.create({
    data: { formationId, token: crypto.randomBytes(16).toString("base64url"), role: "STAGIAIRE", createdByLabel: actorLabel },
  });
}

// Nouveau lien : l'ancien (et son QR code déjà imprimé ou partagé) ne fonctionne plus.
export async function regenerateInvite(formationId: string, actorLabel: string) {
  await prisma.formationInvite.updateMany({ where: { formationId, revokedAt: null, email: null }, data: { revokedAt: new Date() } });
  return getOrCreateInvite(formationId, actorLabel);
}

export async function findActiveInvite(token: string) {
  if (!token || token.length > 64) return null;
  const invite = await prisma.formationInvite.findUnique({
    where: { token },
    select: {
      id: true,
      role: true,
      email: true,
      revokedAt: true,
      usedAt: true,
      expiresAt: true,
      formation: { select: { id: true, name: true, location: true, startDate: true, endDate: true } },
    },
  });
  if (!invite || invite.revokedAt || invite.usedAt) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) return null;
  return invite;
}

// Invitation d'équipe envoyée par email : réservée à cette adresse, utilisable une fois, 7 jours.
// Une nouvelle invitation pour la même adresse et la même session remplace la précédente.
export async function createPersonalInvite(formationId: string, email: string, role: string, actorLabel: string) {
  await prisma.formationInvite.updateMany({
    where: { formationId, email, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() },
  });
  return prisma.formationInvite.create({
    data: {
      formationId,
      token: crypto.randomBytes(16).toString("base64url"),
      role,
      email,
      expiresAt: new Date(Date.now() + PERSONAL_INVITE_TTL_MS),
      createdByLabel: actorLabel,
    },
  });
}

// Rattache le compte à la session de l'invitation. Déjà membre de cette session (quel que soit son
// rôle) : rien ne change, on le laisse simplement ouvrir la session.
// legacyCode : ancien code personnel (avant les comptes) saisi une dernière fois pour récupérer sa
// fiche et son historique — accepté seulement si la fiche est un stagiaire de cette session, pas
// encore reliée à un compte, et si son prénom correspond à celui du compte.
export async function joinWithInvite(
  userId: string,
  token: string,
  legacyCode?: string | null
): Promise<{ formationId: string; alreadyMember: boolean; recovered: boolean }> {
  const invite = await findActiveInvite(token);
  if (!invite) throw new TeamError("Ce lien d'invitation n'est plus valide. Demandez le nouveau lien à votre directeur ou directrice.");

  const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, platformRole: true } });
  if (joiner?.platformRole === "SUPERADMIN") throw new TeamError("Le compte super-admin n'est rattaché à aucune session.");

  // Invitation personnelle : uniquement pour le compte de l'adresse invitée, une seule fois.
  if (invite.email) {
    const user = joiner;
    if (!user || user.email !== invite.email) {
      throw new TeamError(`Cette invitation est réservée à ${invite.email}. Connectez-vous avec ce compte.`);
    }
  }
  const markUsed = () =>
    invite.email
      ? prisma.formationInvite.update({ where: { id: invite.id }, data: { usedAt: new Date(), joinCount: { increment: 1 } } })
      : prisma.formationInvite.update({ where: { id: invite.id }, data: { joinCount: { increment: 1 } } });

  const existing = await prisma.formationMember.findUnique({
    where: { formationId_userId: { formationId: invite.formation.id, userId } },
    select: { id: true },
  });
  if (existing) {
    if (invite.email) await markUsed();
    return { formationId: invite.formation.id, alreadyMember: true, recovered: false };
  }

  if (legacyCode && !invite.email) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const fiche = /^\d{4}$/.test(legacyCode)
      ? await prisma.player.findUnique({
          where: { formationId_code: { formationId: invite.formation.id, code: legacyCode } },
          select: { id: true, firstName: true, role: true, member: { select: { id: true } } },
        })
      : null;
    if (!fiche || fiche.role !== "STAGIAIRE" || fiche.member || !user || !matchesName(fiche.firstName, user.firstName)) {
      throw new TeamError("Cet ancien code ne correspond pas à votre prénom dans cette session. Vérifiez-le, ou laissez le champ vide.");
    }
    await prisma.formationMember.create({ data: { formationId: invite.formation.id, userId, role: "STAGIAIRE", playerId: fiche.id } });
    await markUsed();
    return { formationId: invite.formation.id, alreadyMember: false, recovered: true };
  }

  await addMember(invite.formation.id, userId, invite.role);
  await markUsed();
  return { formationId: invite.formation.id, alreadyMember: false, recovered: false };
}
