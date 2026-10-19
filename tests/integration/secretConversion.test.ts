// Vrai secret → faux secret (maître du jeu) — règles côté serveur, sur la BASE DE TEST :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/secretConversion.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { convertSecretToDecoy, mustReplaceSecret, authorsAwaitingNewSecret, ConversionError } from "@/lib/secretConversion";
import { effectiveParticipation, expireOverdueParticipants } from "@/lib/gameAccess";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

const LONG_AGO = new Date(Date.now() - 3 * 24 * 3600_000); // acceptation il y a 3 jours (délai de 24 h dépassé)

async function scenario({ ended = false } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST conversion ${Date.now()}`, code: `TCV${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: LONG_AGO.toISOString() },
      { formationId: f.id, key: "gameStartedAt", value: LONG_AGO.toISOString() },
      ...(ended ? [{ formationId: f.id, key: "gameEnded", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string, points = 0) =>
    prisma.player.create({
      data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", gameParticipationAt: LONG_AGO, points },
    });
  const P = { ana: await mk("Ana", 12), cam: await mk("Cam") };
  const S = {
    ana: (await prisma.secret.create({ data: { formationId: f.id, playerId: P.ana.id, content: "secret d'Ana", bonus: 3, status: "PUBLISHED" } })).id,
    cam: (await prisma.secret.create({ data: { formationId: f.id, playerId: P.cam.id, content: "secret de Cam", bonus: 2, status: "PUBLISHED" } })).id,
  };
  return { f, P, S };
}
type Sc = Awaited<ReturnType<typeof scenario>>;
const cleanup = async (s: Sc) => {
  await prisma.buzz.deleteMany({ where: { secret: { formationId: s.f.id } } });
  await prisma.formation.delete({ where: { id: s.f.id } });
};
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof ConversionError && re.test(e.message));

test("transformation : le secret passe sur une fiche de faux secret cachée, l'auteur garde ses points et doit en proposer un autre", async () => {
  const s = await scenario();
  try {
    await prisma.buzz.create({ data: { fromPlayerId: s.P.cam.id, secretId: s.S.ana, guessedName: "Zoé", isCorrect: false, status: "REJECTED" } });
    assert.equal(await mustReplaceSecret(s.P.ana.id), false);
    const r = await convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana });
    assert.equal(r.authorFirstName, "Ana");
    const sec = await prisma.secret.findUniqueOrThrow({ where: { id: s.S.ana }, include: { player: true } });
    assert.equal(sec.isDecoy, true);
    assert.equal(sec.status, "PUBLISHED");
    assert.equal(sec.bonus, 3);
    assert.equal(sec.content, "secret d'Ana");
    assert.equal(sec.convertedFromPlayerId, s.P.ana.id);
    assert.equal(sec.player.firstName, r.decoyFirstName);
    assert.equal(sec.player.active, false);
    assert.equal(sec.player.fakeVisible, false, "prénom inventé caché par défaut");
    assert.equal(await prisma.buzz.count({ where: { secretId: s.S.ana } }), 1, "buzz passés conservés");
    const ana = await prisma.player.findUniqueOrThrow({ where: { id: s.P.ana.id }, include: { secret: true } });
    assert.equal(ana.points, 12);
    assert.equal(ana.secret, null);
    assert.equal(await mustReplaceSecret(s.P.ana.id), true);
    await refused(convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana }), /déjà un faux secret/);
  } finally {
    await cleanup(s);
  }
});

test("l'auteur n'est pas exclu par le délai de 24 h sans secret (les autres, si)", async () => {
  const s = await scenario();
  try {
    await convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana });
    const lonely = await prisma.player.create({
      data: { formationId: s.f.id, firstName: "Léo", code: "4242", gameParticipation: "ACCEPTED", gameParticipationAt: LONG_AGO },
    });
    await expireOverdueParticipants(s.f.id);
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: s.P.ana.id } })).gameParticipation, "ACCEPTED");
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: lonely.id } })).gameParticipation, "EXPIRED");
    assert.equal(await effectiveParticipation({ id: s.P.ana.id, gameParticipation: "ACCEPTED" }), "ACCEPTED");
    // Nouvelle proposition en attente : plus besoin de remplacer ; refusée : de nouveau possible.
    await prisma.secret.create({ data: { formationId: s.f.id, playerId: s.P.ana.id, content: "nouveau", bonus: 1, status: "PENDING" } });
    assert.equal(await mustReplaceSecret(s.P.ana.id), false);
    await prisma.secret.update({ where: { playerId: s.P.ana.id }, data: { status: "REJECTED" } });
    assert.equal(await mustReplaceSecret(s.P.ana.id), true);
  } finally {
    await cleanup(s);
  }
});

test("buzz en attente, bonne réponse comprise : la transformation passe et les rend faux (aucun point)", async () => {
  const s = await scenario();
  try {
    const right = await prisma.buzz.create({ data: { fromPlayerId: s.P.cam.id, secretId: s.S.ana, guessedName: "Ana", isCorrect: true, status: "PENDING" } });
    const wrong = await prisma.buzz.create({ data: { fromPlayerId: s.P.cam.id, secretId: s.S.ana, guessedName: "Zoé", isCorrect: false, status: "PENDING" } });
    const before = (await prisma.player.findUniqueOrThrow({ where: { id: s.P.cam.id } })).points;
    const done = await convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana });
    assert.equal(done.closedBuzzes, 2);
    for (const id of [right.id, wrong.id]) {
      const b = await prisma.buzz.findUniqueOrThrow({ where: { id } });
      assert.deepEqual([b.status, b.isCorrect], ["REJECTED", false]);
    }
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: s.P.cam.id } })).points, before, "la bonne réponse annulée ne rapporte rien");
    const secret = await prisma.secret.findUniqueOrThrow({ where: { id: s.S.ana } });
    assert.deepEqual([secret.isDecoy, secret.status], [true, "PUBLISHED"]);
  } finally {
    await cleanup(s);
  }
});

test("refus : mise à prix non réglée, fausse identité active, secret trouvé, partie terminée", async () => {
  const s = await scenario();
  const ended = await scenario({ ended: true });
  try {
    const bounty = await prisma.gamePower.create({ data: { formationId: s.f.id, playerId: s.P.ana.id, kind: "BOUNTY", cost: 3, endsAt: new Date(Date.now() - 3600_000), status: "EXPIRED" } });
    await refused(convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana }), /mise à prix/);
    await prisma.gamePower.update({ where: { id: bounty.id }, data: { stakeSettledAt: new Date(), stakeOutcome: "REFUNDED" } });

    await prisma.gamePower.create({ data: { formationId: s.f.id, playerId: s.P.ana.id, kind: "FAKE_IDENTITY", endsAt: new Date(Date.now() + 3600_000) } });
    await refused(convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana }), /fausse identité/);

    await prisma.secret.update({ where: { id: s.S.cam }, data: { status: "FOUND", foundByPlayerId: s.P.ana.id } });
    await refused(convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.cam }), /validé et pas encore trouvé/);

    await refused(convertSecretToDecoy({ formationId: ended.f.id, secretId: ended.S.ana }), /inscriptions ou la partie/);
    await refused(convertSecretToDecoy({ formationId: s.f.id, secretId: ended.S.ana }), /introuvable/);
  } finally {
    await cleanup(s);
    await cleanup(ended);
  }
});

test("point de nuit : l'auteur le garde en attendant son nouveau secret, plus après validation (compté comme auteur) ni si trouvé", async () => {
  const s = await scenario();
  try {
    assert.deepEqual(await authorsAwaitingNewSecret(s.f.id), []);
    await convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.ana });
    assert.deepEqual(await authorsAwaitingNewSecret(s.f.id), [s.P.ana.id], "sans secret");
    const fresh = await prisma.secret.create({ data: { formationId: s.f.id, playerId: s.P.ana.id, content: "nouveau", bonus: 1, status: "PENDING" } });
    assert.deepEqual(await authorsAwaitingNewSecret(s.f.id), [s.P.ana.id], "nouveau secret en attente");
    await prisma.secret.update({ where: { id: fresh.id }, data: { status: "PUBLISHED" } });
    assert.deepEqual(await authorsAwaitingNewSecret(s.f.id), [], "validé : compté comme tout auteur");
    await prisma.secret.update({ where: { id: fresh.id }, data: { status: "FOUND" } });
    assert.deepEqual(await authorsAwaitingNewSecret(s.f.id), [], "trouvé : plus de point");
  } finally {
    await cleanup(s);
  }
});

test("deux transformations simultanées : une seule passe", async () => {
  const s = await scenario();
  try {
    const r = await Promise.allSettled([convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.cam }), convertSecretToDecoy({ formationId: s.f.id, secretId: s.S.cam })]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(await prisma.player.count({ where: { formationId: s.f.id, active: false } }), 1, "une seule fiche de faux secret");
  } finally {
    await cleanup(s);
  }
});
