import { prisma } from "@/lib/prisma";
import { generateUniquePlayerCode } from "@/lib/playerCode";
import { findMatchingPlayer } from "@/lib/nameCollision";
import { isMemberRole, type MemberRole } from "@/lib/access";

// Rattachement d'un compte BafaPilot à l'équipe d'une formation. Le BAFA Manager ne connaît que
// les fiches Player : chaque membre en a donc une, soit reprise parmi les fiches d'équipe
// existantes (formateurs/directeurs d'avant les comptes), soit créée pour l'occasion.

export class TeamError extends Error {}

// Fiches d'équipe (formateur/directeur) de la formation qui ne sont encore reliées à aucun compte.
export async function linkableStaffPlayers(formationId: string) {
  return prisma.player.findMany({
    where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] }, member: null },
    select: { id: true, firstName: true, role: true },
    orderBy: { firstName: "asc" },
  });
}

// Prénom affiché dans le BAFA Manager : le prénom seul s'il n'évoque aucune fiche existante
// (détection floue, comme ailleurs dans l'appli), sinon complété par l'initiale puis le nom de
// famille — ces variantes n'ont qu'à différer exactement des fiches existantes : « Claire D. »
// reste lisiblement distincte d'une stagiaire « Claire ».
async function uniqueDisplayName(formationId: string, firstName: string, lastName: string): Promise<string> {
  if (!(await findMatchingPlayer(formationId, firstName))) return firstName;

  const taken = new Set(
    (await prisma.player.findMany({ where: { formationId }, select: { firstName: true } })).map((p) => p.firstName.trim().toLowerCase())
  );
  for (const name of [`${firstName} ${lastName.charAt(0).toUpperCase()}.`, `${firstName} ${lastName}`]) {
    if (!taken.has(name.toLowerCase())) return name;
  }
  throw new TeamError(`Une personne nommée « ${firstName} ${lastName} » existe déjà dans cette session. Reliez plutôt le compte à sa fiche existante.`);
}

export async function addMember(formationId: string, userId: string, role: string, linkPlayerId?: string | null) {
  if (!isMemberRole(role)) throw new TeamError("Rôle invalide.");
  const [formation, user, existing] = await Promise.all([
    prisma.formation.findUnique({ where: { id: formationId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true } }),
    prisma.formationMember.findUnique({ where: { formationId_userId: { formationId, userId } }, select: { id: true } }),
  ]);
  if (!formation) throw new TeamError("Session introuvable.");
  if (!user) throw new TeamError("Compte introuvable.");
  if (existing) throw new TeamError("Cette personne fait déjà partie de l'équipe de cette session.");

  let playerId: string;
  if (linkPlayerId) {
    const player = await prisma.player.findUnique({
      where: { id: linkPlayerId },
      select: { formationId: true, role: true, member: { select: { id: true } } },
    });
    if (!player || player.formationId !== formationId || !["FORMATEUR", "DIRECTEUR"].includes(player.role)) {
      throw new TeamError("Fiche d'équipe invalide pour cette session.");
    }
    if (player.member) throw new TeamError("Cette fiche est déjà reliée à un autre compte.");
    playerId = linkPlayerId;
    // La fiche prend le rôle choisi pour le compte : un seul rôle fait foi dans la session.
    await prisma.player.update({ where: { id: playerId }, data: { role } });
  } else {
    const firstName = await uniqueDisplayName(formationId, user.firstName, user.lastName);
    const code = await generateUniquePlayerCode(formationId); // valeur cachée, jamais communiquée
    const player = await prisma.player.create({ data: { formationId, firstName, code, role }, select: { id: true } });
    playerId = player.id;
  }

  try {
    return await prisma.formationMember.create({
      data: { formationId, userId, role, playerId },
      select: { id: true, role: true, player: { select: { firstName: true } } },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw new TeamError("Cette personne fait déjà partie de l'équipe, ou cette fiche est déjà reliée.");
    }
    throw e;
  }
}

export async function setMemberRole(memberId: string, role: MemberRole) {
  const member = await prisma.formationMember.update({ where: { id: memberId }, data: { role }, select: { playerId: true } });
  if (member.playerId) await prisma.player.update({ where: { id: member.playerId }, data: { role } });
}

// Retire le compte de l'équipe. La fiche Player (et tout l'historique du BAFA Manager qui s'y
// rattache : évaluations, remarques, créneaux…) est conservée, simplement détachée du compte.
export async function removeMember(memberId: string) {
  await prisma.formationMember.delete({ where: { id: memberId } });
}

// Données du composant d'équipe (TeamManager) pour une formation.
export async function loadTeam(formationId: string) {
  const [rows, linkable] = await Promise.all([
    prisma.formationMember.findMany({
      where: { formationId, role: { in: ["DIRECTEUR", "FORMATEUR"] } },
      select: {
        id: true,
        role: true,
        user: { select: { firstName: true, lastName: true, email: true, emailVerifiedAt: true } },
        player: { select: { firstName: true } },
      },
      orderBy: [{ role: "asc" }, { user: { lastName: "asc" } }],
    }),
    linkableStaffPlayers(formationId),
  ]);
  const members = rows.map((m) => ({
    id: m.id,
    role: m.role,
    name: `${m.user.firstName} ${m.user.lastName}`,
    email: m.user.email,
    verified: !!m.user.emailVerifiedAt,
    playerName: m.player?.firstName ?? null,
  }));
  return { members, linkable };
}

// Fiche Player d'un membre, recréée si elle a disparu (ex. supprimée depuis l'ancien écran
// d'équipe) : ouvrir la session doit toujours mener à une fiche valide dans le BAFA Manager.
export async function ensureMemberPlayer(memberId: string): Promise<string> {
  const member = await prisma.formationMember.findUnique({
    where: { id: memberId },
    select: { formationId: true, role: true, playerId: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!member) throw new TeamError("Rattachement introuvable.");
  if (member.playerId) return member.playerId;

  const firstName = await uniqueDisplayName(member.formationId, member.user.firstName, member.user.lastName);
  const code = await generateUniquePlayerCode(member.formationId);
  const player = await prisma.player.create({ data: { formationId: member.formationId, firstName, code, role: member.role }, select: { id: true } });
  await prisma.formationMember.update({ where: { id: memberId }, data: { playerId: player.id } });
  return player.id;
}
