// Défis du maître du jeu — règles côté serveur, sur la BASE DE TEST :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/gameChallenges.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import {
  ChallengeError,
  challengeRecipientsChoice,
  createChallenge,
  sendChallengeMails,
  pendingChallengesForPlayer,
  respondToChallenge,
  cancelChallenge,
  closePendingChallenges,
  challengesForAdmin,
} from "@/lib/gameChallenges";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

async function scenario({ started = true, ended = false } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST défis ${Date.now()}`, code: `TCH${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: new Date().toISOString() },
      ...(started ? [{ formationId: f.id, key: "gameStartedAt", value: new Date().toISOString() }] : []),
      ...(ended ? [{ formationId: f.id, key: "gameEnded", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string, extra = {}) =>
    prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", gameParticipationAt: new Date(), ...extra } });
  const P = {
    ana: await mk("Ana"),
    cam: await mk("Cam"),
    out: await mk("Léo", { gameParticipation: "DECLINED" }),
    gm: await mk("Dina", { isGameMaster: true, gameParticipation: null }),
  };
  const user = await prisma.user.create({ data: { firstName: "Ana", lastName: "Test", email: `ana.${Date.now()}@test.invalid`, passwordHash: "x" } });
  await prisma.formationMember.create({ data: { formationId: f.id, userId: user.id, role: "STAGIAIRE", playerId: P.ana.id } });
  return { f, P, user };
}
type Sc = Awaited<ReturnType<typeof scenario>>;
const cleanup = async (s: Sc) => {
  await prisma.formation.delete({ where: { id: s.f.id } });
  await prisma.user.delete({ where: { id: s.user.id } });
};
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof ChallengeError && re.test(e.message));
const rec = (challengeId: string, playerId: string) => prisma.gameChallengeRecipient.findUniqueOrThrow({ where: { challengeId_playerId: { challengeId, playerId } } });

test("destinataires : joueurs acceptés seulement, ni maître du jeu ni refus ; adresse mail détectée", async () => {
  const s = await scenario();
  try {
    const list = await challengeRecipientsChoice(s.f.id);
    assert.deepEqual(list.map((p) => [p.firstName, p.hasEmail]), [["Ana", true], ["Cam", false]]);
    const id = await createChallenge({ formationId: s.f.id, text: "  Chante !  ", deadline: null, playerIds: "ALL", actorLabel: "Dina (maître du jeu)" });
    const c = await prisma.gameChallenge.findUniqueOrThrow({ where: { id }, include: { recipients: true } });
    assert.equal(c.text, "Chante !");
    assert.equal(c.recipients.length, 2);
    await refused(createChallenge({ formationId: s.f.id, text: "x", deadline: null, playerIds: [s.P.gm.id], actorLabel: "GM" }), /ne participe pas/);
    await refused(createChallenge({ formationId: s.f.id, text: "x", deadline: null, playerIds: [s.P.out.id], actorLabel: "GM" }), /ne participe pas/);
    await refused(createChallenge({ formationId: s.f.id, text: "x", deadline: null, playerIds: [], actorLabel: "GM" }), /au moins un joueur/);
    await refused(createChallenge({ formationId: s.f.id, text: "   ", deadline: null, playerIds: "ALL", actorLabel: "GM" }), /Écris le défi/);
    await refused(createChallenge({ formationId: s.f.id, text: "x", deadline: new Date(Date.now() - 1000), playerIds: "ALL", actorLabel: "GM" }), /futur/);
  } finally {
    await cleanup(s);
  }
});

test("emails : envoyé à qui a une adresse, noté « pas d'adresse » sinon, une seule fois", async () => {
  const s = await scenario();
  try {
    const id = await createChallenge({ formationId: s.f.id, text: "Défi", deadline: null, playerIds: "ALL", actorLabel: "GM" });
    await sendChallengeMails(id);
    assert.equal((await rec(id, s.P.ana.id)).mailStatus, "SENT"); // hors production sans SMTP : affiché dans la console
    assert.equal((await rec(id, s.P.cam.id)).mailStatus, "NO_EMAIL");
    await prisma.gameChallengeRecipient.update({ where: { challengeId_playerId: { challengeId: id, playerId: s.P.ana.id } }, data: { mailStatus: "FAILED" } });
    await sendChallengeMails(id);
    assert.equal((await rec(id, s.P.ana.id)).mailStatus, "FAILED", "pas de second envoi");
  } finally {
    await cleanup(s);
  }
});

test("réponse : accepter ou refuser une seule fois, seulement le sien, pas après la date limite", async () => {
  const s = await scenario();
  try {
    const id = await createChallenge({ formationId: s.f.id, text: "Défi", deadline: new Date(Date.now() + 3600_000), playerIds: [s.P.ana.id], actorLabel: "GM" });
    const [mine] = await pendingChallengesForPlayer(s.P.ana.id);
    assert.equal(mine.text, "Défi");
    assert.deepEqual(await pendingChallengesForPlayer(s.P.cam.id), []);
    await refused(respondToChallenge({ playerId: s.P.cam.id, recipientId: mine.id, accept: true }), /n'attend plus/);
    await refused(respondToChallenge({ playerId: s.P.ana.id, recipientId: mine.id, accept: true, now: new Date(Date.now() + 2 * 3600_000) }), /n'attend plus/);
    const both = await Promise.allSettled([
      respondToChallenge({ playerId: s.P.ana.id, recipientId: mine.id, accept: true }),
      respondToChallenge({ playerId: s.P.ana.id, recipientId: mine.id, accept: false }),
    ]);
    assert.equal(both.filter((r) => r.status === "fulfilled").length, 1, "deux réponses simultanées : une seule retenue");
    assert.deepEqual(await pendingChallengesForPlayer(s.P.ana.id), []);
    assert.ok(["ACCEPTED", "REFUSED"].includes((await rec(id, s.P.ana.id)).status));
  } finally {
    await cleanup(s);
  }
});

test("date limite dépassée : invisible pour le joueur, « expiré » pour le maître du jeu", async () => {
  const s = await scenario();
  try {
    await createChallenge({ formationId: s.f.id, text: "Vite", deadline: new Date(Date.now() + 60_000), playerIds: "ALL", actorLabel: "GM" });
    const later = new Date(Date.now() + 120_000);
    assert.deepEqual(await pendingChallengesForPlayer(s.P.ana.id, later), []);
    const [c] = await challengesForAdmin(s.f.id, later);
    assert.deepEqual(c.recipients.map((r) => r.status), ["EXPIRED", "EXPIRED"]);
  } finally {
    await cleanup(s);
  }
});

test("annulation et fin de partie : réponses en attente closes, réponses données conservées", async () => {
  const s = await scenario();
  try {
    const a = await createChallenge({ formationId: s.f.id, text: "A", deadline: null, playerIds: "ALL", actorLabel: "GM" });
    const [ra] = await pendingChallengesForPlayer(s.P.ana.id);
    await respondToChallenge({ playerId: s.P.ana.id, recipientId: ra.id, accept: true });
    await cancelChallenge(s.f.id, a);
    assert.equal((await rec(a, s.P.ana.id)).status, "ACCEPTED");
    assert.equal((await rec(a, s.P.cam.id)).status, "CANCELLED");
    await refused(cancelChallenge(s.f.id, a), /déjà annulé/);

    const b = await createChallenge({ formationId: s.f.id, text: "B", deadline: null, playerIds: "ALL", actorLabel: "GM" });
    await prisma.$transaction((tx) => closePendingChallenges(tx, s.f.id));
    assert.equal((await rec(b, s.P.cam.id)).status, "CLOSED");
    assert.deepEqual(await pendingChallengesForPlayer(s.P.cam.id), []);
  } finally {
    await cleanup(s);
  }
});

test("hors partie : pas de défi après la fin du jeu ; possible pendant les inscriptions", async () => {
  const ended = await scenario({ ended: true });
  const open = await scenario({ started: false });
  try {
    await refused(createChallenge({ formationId: ended.f.id, text: "x", deadline: null, playerIds: "ALL", actorLabel: "GM" }), /inscriptions ou la partie/);
    assert.ok(await createChallenge({ formationId: open.f.id, text: "x", deadline: null, playerIds: "ALL", actorLabel: "GM" }));
  } finally {
    await cleanup(ended);
    await cleanup(open);
  }
});
