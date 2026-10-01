import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { addMember, TeamError } from "@/lib/team";
import { appUrl } from "@/lib/mail";

// Lien d'invitation (QR code) d'une session : « Ajouter les stagiaires à la session ». En l'ouvrant,
// on crée son compte ou on se connecte, puis on est rattaché automatiquement en Stagiaire.

export const invitePath = (token: string) => `/rejoindre/${token}`;
export const inviteUrl = (token: string) => appUrl(invitePath(token));

// Lien actif de la session, créé au premier besoin.
export async function getOrCreateInvite(formationId: string, actorLabel: string) {
  const current = await prisma.formationInvite.findFirst({
    where: { formationId, revokedAt: null, role: "STAGIAIRE" },
    orderBy: { createdAt: "desc" },
  });
  if (current) return current;
  return prisma.formationInvite.create({
    data: { formationId, token: crypto.randomBytes(16).toString("base64url"), role: "STAGIAIRE", createdByLabel: actorLabel },
  });
}

// Nouveau lien : l'ancien (et son QR code déjà imprimé ou partagé) ne fonctionne plus.
export async function regenerateInvite(formationId: string, actorLabel: string) {
  await prisma.formationInvite.updateMany({ where: { formationId, revokedAt: null }, data: { revokedAt: new Date() } });
  return getOrCreateInvite(formationId, actorLabel);
}

export async function findActiveInvite(token: string) {
  if (!token || token.length > 64) return null;
  const invite = await prisma.formationInvite.findUnique({
    where: { token },
    select: {
      id: true,
      role: true,
      revokedAt: true,
      formation: { select: { id: true, name: true, location: true, startDate: true, endDate: true } },
    },
  });
  return invite && !invite.revokedAt ? invite : null;
}

// Rattache le compte à la session de l'invitation. Déjà membre de cette session (quel que soit son
// rôle) : rien ne change, on le laisse simplement ouvrir la session.
export async function joinWithInvite(userId: string, token: string): Promise<{ formationId: string; alreadyMember: boolean }> {
  const invite = await findActiveInvite(token);
  if (!invite) throw new TeamError("Ce lien d'invitation n'est plus valide. Demandez le nouveau lien à votre directeur ou directrice.");

  const existing = await prisma.formationMember.findUnique({
    where: { formationId_userId: { formationId: invite.formation.id, userId } },
    select: { id: true },
  });
  if (existing) return { formationId: invite.formation.id, alreadyMember: true };

  await addMember(invite.formation.id, userId, invite.role);
  await prisma.formationInvite.update({ where: { id: invite.id }, data: { joinCount: { increment: 1 } } });
  return { formationId: invite.formation.id, alreadyMember: false };
}
