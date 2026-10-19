// Secret mis à prix — règles côté serveur, sur la BASE DE TEST, heures injectées :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/bounty.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { activateBounty, settleBountyHits, settleExpiredBounties, settleBountiesAtGameEnd, getBountyState } from "@/lib/bounty";
import { buyFakeIdentity, PowerError, endPowersAtGameEnd } from "@/lib/fakeIdentity";
import { resolveWinningBuzz } from "@/lib/buzzResolution";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

const H = 3600_000;
const T0 = new Date(Date.now() - 2 * H); // activation il y a 2 h (fenêtre ouverte « maintenant »)

async function scenario({ rule = true, camille = 10 } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST bounty ${Date.now()}`, code: `TBY${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: new Date().toISOString() },
      { formationId: f.id, key: "gameStartedAt", value: "2026-10-19T06:00:00.000Z" },
      ...(rule ? [{ formationId: f.id, key: "rule_bounty", value: "true" }, { formationId: f.id, key: "rule_fakeIdentity", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string, points: number) =>
    prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", points } });
  const P = { camille: await mk("Camille", camille), tom: await mk("Tom", 10), lea: await mk("Léa", 2), max: await mk("Max", 0), zoe: await mk("Zoé", 10) };
  const S: Record<string, string> = {};
  for (const n of ["camille", "tom", "lea", "max", "zoe"] as const) {
    S[n] = (await prisma.secret.create({ data: { formationId: f.id, playerId: P[n].id, content: `secret de ${n}`, bonus: 2, status: "PUBLISHED" } })).id;
  }
  return { f, P, S };
}
type Sc = Awaited<ReturnType<typeof scenario>>;
const cleanup = async (id: string) => {
  await prisma.buzz.deleteMany({ where: { secret: { formationId: id } } });
  await prisma.formation.delete({ where: { id } });
};
const pts = async (id: string) => (await prisma.player.findUniqueOrThrow({ where: { id } })).points;
const ledger = (formationId: string, kind?: string) => prisma.pointTransaction.findMany({ where: { formationId, ...(kind ? { kind } : {}) } });
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof PowerError && re.test(e.message));
const activate = (s: Sc, stake = 3, now = T0) => activateBounty({ formationId: s.f.id, playerId: s.P.camille.id, stake, now });
// Buzz faux « Camille » sur le secret de Tom, envoyé à `at`, puis rejeté (résultat définitif).
async function wrongBuzz(s: Sc, from: keyof Sc["P"], at: Date, reject = true) {
  const b = await prisma.buzz.create({ data: { secretId: s.S.tom, fromPlayerId: s.P[from].id, guessedName: "Camille", status: reject ? "REJECTED" : "PENDING", isCorrect: false, createdAt: at } });
  if (reject) await settleBountyHits([b.id]);
  return b;
}
async function sumOk(s: Sc, initial: Record<string, number>) {
  for (const [n, start] of Object.entries(initial)) {
    const id = s.P[n as keyof Sc["P"]].id;
    const sum = (await prisma.pointTransaction.findMany({ where: { playerId: id } })).reduce((a, t) => a + t.delta, 0);
    assert.equal(await pts(id), start + sum, `score = départ + journal (${n})`);
  }
}

test("activation : mise retirée et réservée, une seule fois, double clic, refus sans effet", async () => {
  const s = await scenario({ camille: 4 });
  const off = await scenario({ rule: false });
  try {
    await refused(activate(s, 5), /mise entre 1 et 5|au moins 5/); // 5 > 4 points
    await refused(activate(s, 6), /entre 1 et 5/);
    await refused(activate(s, 0), /entre 1 et 5/);
    assert.equal(await pts(s.P.camille.id), 4);
    assert.equal((await ledger(s.f.id)).length, 0);
    const r = await Promise.allSettled([activate(s), activate(s), activate(s)]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(await pts(s.P.camille.id), 1);
    assert.deepEqual((await ledger(s.f.id)).map((l) => [l.kind, l.delta]), [["BOUNTY_STAKE", -3]]);
    await refused(activate(s, 1), /déjà mis ton secret à prix/);
    await refused(activateBounty({ formationId: off.f.id, playerId: off.P.camille.id, stake: 1 }), /pas activé/);
  } finally {
    await cleanup(s.f.id);
    await cleanup(off.f.id);
  }
});

test("incompatibilité avec la fausse identité, dans les deux sens", async () => {
  const s = await scenario();
  const s2 = await scenario();
  try {
    await buyFakeIdentity({ formationId: s.f.id, playerId: s.P.camille.id, aliasPlayerId: s.P.tom.id, now: T0 });
    await refused(activate(s, 2, new Date(T0.getTime() + H)), /fausse identité/);
    await activateBounty({ formationId: s2.f.id, playerId: s2.P.camille.id, stake: 2, now: T0 });
    await refused(buyFakeIdentity({ formationId: s2.f.id, playerId: s2.P.camille.id, aliasPlayerId: s2.P.tom.id, now: new Date(T0.getTime() + H) }), /mis à prix/);
    assert.match((await getBountyState(s.f.id, s.P.camille.id)).reason ?? "", /fausse identité/);
  } finally {
    await cleanup(s.f.id);
    await cleanup(s2.f.id);
  }
});

test("transferts : seulement une fois le buzz définitif, une fois par adversaire, plafonnés au solde", async () => {
  const s = await scenario();
  try {
    await activate(s, 3);
    const during = new Date(T0.getTime() + H);
    const pending = await wrongBuzz(s, "zoe", during, false);
    await settleBountyHits([pending.id]);
    assert.equal(await pts(s.P.zoe.id), 10, "en attente : aucun transfert");
    await prisma.buzz.update({ where: { id: pending.id }, data: { status: "REJECTED" } });
    await Promise.all([settleBountyHits([pending.id]), settleBountyHits([pending.id])]); // rejeu concurrent
    assert.deepEqual([await pts(s.P.zoe.id), await pts(s.P.camille.id)], [7, 10]);
    await wrongBuzz(s, "zoe", new Date(T0.getTime() + 2 * H)); // même adversaire : pas de second transfert
    assert.equal(await pts(s.P.zoe.id), 7);
    await wrongBuzz(s, "lea", during); // 2 points seulement : débit plafonné
    assert.deepEqual([await pts(s.P.lea.id), await pts(s.P.camille.id)], [0, 12]);
    await wrongBuzz(s, "max", during); // 0 point : rien à prendre, jamais négatif
    assert.equal(await pts(s.P.max.id), 0);
    assert.equal(await prisma.bountyHit.count(), await prisma.bountyHit.count()); // (lisibilité)
    const hits = await prisma.bountyHit.findMany({ where: { power: { formationId: s.f.id } }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(hits.map((h) => h.amount), [3, 2, 0]);
    await sumOk(s, { camille: 10, zoe: 10, lea: 2, max: 0 });
  } finally {
    await cleanup(s.f.id);
  }
});

test("hors fenêtre et cas sans transfert : avant l'activation, après 24 h, son propre secret, bonne réponse", async () => {
  const s = await scenario();
  try {
    await activate(s, 3);
    await wrongBuzz(s, "zoe", new Date(T0.getTime() - 60_000)); // avant
    await wrongBuzz(s, "tom", new Date(T0.getTime() + 24 * H)); // à l'échéance
    const own = await prisma.buzz.create({ data: { secretId: s.S.camille, fromPlayerId: s.P.lea.id, guessedName: "Camille", status: "VALIDATED", isCorrect: true, createdAt: new Date(T0.getTime() + H) } });
    await settleBountyHits([own.id]);
    assert.deepEqual([await pts(s.P.zoe.id), await pts(s.P.tom.id), await pts(s.P.lea.id), await pts(s.P.camille.id)], [10, 10, 2, 7]);
  } finally {
    await cleanup(s.f.id);
  }
});

test("validation différée : buzz envoyé pendant la mise, rejeté après les 24 h → transfert quand même", async () => {
  const s = await scenario();
  try {
    await activate(s, 3, new Date(Date.now() - 30 * H)); // fenêtre terminée il y a 6 h
    const b = await wrongBuzz(s, "zoe", new Date(Date.now() - 29 * H), false);
    assert.equal(await settleExpiredBounties(s.f.id), 1); // aucune bonne réponse en attente : mise rendue
    assert.equal(await pts(s.P.camille.id), 10);
    await prisma.buzz.update({ where: { id: b.id }, data: { status: "REJECTED" } });
    await settleBountyHits([b.id]);
    assert.deepEqual([await pts(s.P.zoe.id), await pts(s.P.camille.id)], [7, 13]);
    await sumOk(s, { camille: 10, zoe: 10 });
  } finally {
    await cleanup(s.f.id);
  }
});

test("mise : rendue une seule fois après 24 h ; retenue tant qu'une bonne réponse de la fenêtre attend", async () => {
  const s = await scenario();
  try {
    const p = await activate(s, 4, new Date(Date.now() - 25 * H));
    const correct = await prisma.buzz.create({ data: { secretId: s.S.camille, fromPlayerId: s.P.tom.id, guessedName: "Camille", status: "PENDING", isCorrect: true, createdAt: new Date(Date.now() - 24.5 * H) } });
    assert.equal(await settleExpiredBounties(s.f.id), 0, "bonne réponse en attente : pas de remboursement prématuré");
    assert.equal(await pts(s.P.camille.id), 6);
    assert.equal((await getBountyState(s.f.id, s.P.camille.id)).active?.awaiting, true);
    // Validée : la mise va à Tom en plus des points habituels.
    const won = await resolveWinningBuzz({ buzzId: correct.id, secretId: s.S.camille, fromPlayerId: s.P.tom.id, secretBonus: 2, secretIsDecoy: false, secretPlayerFirstName: "Camille", formationId: s.f.id });
    assert.equal(won, 4);
    assert.equal(await pts(s.P.tom.id), 10 + 4 + 4);
    assert.equal(await settleExpiredBounties(s.f.id), 0);
    assert.equal(await pts(s.P.camille.id), 6, "jamais rendue après avoir été gagnée");
    const power = await prisma.gamePower.findUniqueOrThrow({ where: { id: p.id } });
    assert.deepEqual([power.stakeOutcome, power.status], ["WON", "ENDED"]);
    assert.equal((await ledger(s.f.id, "BOUNTY_WON")).length, 1);
    assert.equal((await ledger(s.f.id, "BOUNTY_REFUND")).length, 0);
    await sumOk(s, { camille: 10, tom: 10 });
  } finally {
    await cleanup(s.f.id);
  }
});

test("bonne réponse en attente puis rejetée : mise rendue au passage suivant", async () => {
  const s = await scenario();
  try {
    await activate(s, 2, new Date(Date.now() - 25 * H));
    const c = await prisma.buzz.create({ data: { secretId: s.S.camille, fromPlayerId: s.P.tom.id, guessedName: "Camille", status: "PENDING", isCorrect: true, createdAt: new Date(Date.now() - 24.5 * H) } });
    assert.equal(await settleExpiredBounties(s.f.id), 0);
    await prisma.buzz.update({ where: { id: c.id }, data: { status: "REJECTED" } });
    assert.equal(await settleExpiredBounties(s.f.id), 1);
    assert.equal(await settleExpiredBounties(s.f.id), 0);
    assert.equal(await pts(s.P.camille.id), 10);
    assert.equal((await ledger(s.f.id, "BOUNTY_REFUND")).length, 1);
  } finally {
    await cleanup(s.f.id);
  }
});

test("secret trouvé pendant la mise : mise au gagnant, transferts arrêtés à la découverte", async () => {
  const s = await scenario();
  try {
    await activate(s, 3);
    const win = await prisma.buzz.create({ data: { secretId: s.S.camille, fromPlayerId: s.P.zoe.id, guessedName: "Camille", status: "PENDING", isCorrect: true, createdAt: new Date(T0.getTime() + H) } });
    // Buzz faux de Tom sur « Camille », envoyé avant la découverte, encore en attente → rendu définitif par la découverte.
    const late = await prisma.buzz.create({ data: { secretId: s.S.lea, fromPlayerId: s.P.tom.id, guessedName: "Camille", status: "PENDING", isCorrect: false, createdAt: new Date(T0.getTime() + 0.5 * H) } });
    await resolveWinningBuzz({ buzzId: win.id, secretId: s.S.camille, fromPlayerId: s.P.zoe.id, secretBonus: 2, secretIsDecoy: false, secretPlayerFirstName: "Camille", formationId: s.f.id });
    assert.equal(await pts(s.P.zoe.id), 10 + 4 + 3);
    assert.equal((await prisma.buzz.findUniqueOrThrow({ where: { id: late.id } })).status, "REJECTED");
    assert.equal(await pts(s.P.tom.id), 7, "le buzz faux envoyé pendant la mise transfère");
    const after1 = await prisma.buzz.create({ data: { secretId: s.S.lea, fromPlayerId: s.P.lea.id, guessedName: "Camille", status: "REJECTED", isCorrect: false, createdAt: new Date(Date.now()) } });
    await settleBountyHits([after1.id]);
    assert.equal(await pts(s.P.lea.id), 2, "après la découverte : plus de transfert");
    await sumOk(s, { camille: 10, zoe: 10, tom: 10, lea: 2 });
  } finally {
    await cleanup(s.f.id);
  }
});

test("bonne réponse envoyée AVANT la mise et validée pendant : mise rendue au propriétaire", async () => {
  const s = await scenario();
  try {
    const early = await prisma.buzz.create({ data: { secretId: s.S.camille, fromPlayerId: s.P.zoe.id, guessedName: "Camille", status: "PENDING", isCorrect: true, createdAt: new Date(T0.getTime() - 60_000) } });
    await activate(s, 3);
    await resolveWinningBuzz({ buzzId: early.id, secretId: s.S.camille, fromPlayerId: s.P.zoe.id, secretBonus: 2, secretIsDecoy: false, secretPlayerFirstName: "Camille", formationId: s.f.id });
    assert.deepEqual([await pts(s.P.zoe.id), await pts(s.P.camille.id)], [14, 10]);
  } finally {
    await cleanup(s.f.id);
  }
});

test("clôture de partie : mise rendue une fois, plus aucun transfert ni règlement ensuite", async () => {
  const s = await scenario();
  try {
    await activate(s, 3);
    const b = await wrongBuzz(s, "zoe", new Date(T0.getTime() + H), false);
    await prisma.$transaction(async (tx) => {
      await settleBountiesAtGameEnd(tx, s.f.id);
      await endPowersAtGameEnd(tx, s.f.id);
      await tx.config.create({ data: { formationId: s.f.id, key: "gameEnded", value: "true" } });
    });
    await prisma.$transaction((tx) => settleBountiesAtGameEnd(tx, s.f.id)); // relancée : rien
    assert.equal(await pts(s.P.camille.id), 10);
    assert.equal((await ledger(s.f.id, "BOUNTY_REFUND")).length, 1);
    await prisma.buzz.update({ where: { id: b.id }, data: { status: "REJECTED" } });
    await settleBountyHits([b.id]);
    assert.equal(await pts(s.P.zoe.id), 10, "après la clôture : aucun transfert");
    assert.equal(await settleExpiredBounties(s.f.id, new Date(Date.now() + 48 * H)), 0);
  } finally {
    await cleanup(s.f.id);
  }
});
